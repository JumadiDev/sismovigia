# -*- coding: utf-8 -*-
"""Deduplicación y canonicalización de eventos sísmicos.

Base: sismovigia-backend
Reglas de coincidencia:
  1. occurred_at dentro de ±2 minutos
  2. distancia ≤ 50 km (haversine)
  3. magnitud dentro de ±0.5
  4. si hay candidato → enlazar; si la fuente nueva tiene más prioridad
     (USGS > SSN) se actualizan primary_source y campos numéricos.
"""
import math
from datetime import timedelta
from datetime import timezone

# Prioridad de fuentes para decidir cuál "gana" al mostrar el evento
PRIORITY = {"usgs": 2, "ssn": 1, "sim": 0}

MATCH_MINUTES = 2   # ±2 min
MATCH_KM = 50       # ≤50 km
MATCH_MAG = 0.5     # ±0.5


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia entre dos puntos en la esfera terrestre (km)."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def alert_level(mag: float) -> str:
    """Mapeo semántico del SPEC: M≥6=alerta, 4.5–5.9=precaucion, <4.5=normal."""
    if mag >= 6.0:
        return "alerta"
    if mag >= 4.5:
        return "precaucion"
    return "normal"


async def find_candidate(pool, occurred_at, lat: float, lon: float, mag: float) -> dict | None:
    """Busca un canonical_events que ya cubra este sismo según las reglas."""
    rows = await pool.fetch(
        """
        SELECT id, latitude, longitude, magnitude, primary_source
        FROM canonical_events
        WHERE occurred_at BETWEEN $1 AND $2
        """,
        occurred_at - timedelta(minutes=MATCH_MINUTES),
        occurred_at + timedelta(minutes=MATCH_MINUTES),
    )
    best = None
    for r in rows:
        if haversine_km(lat, lon, r["latitude"], r["longitude"]) > MATCH_KM:
            continue
        if abs(r["magnitude"] - mag) > MATCH_MAG:
            continue
        # entre varios candidatos, se queda con la fuente más confiable
        if best is None or PRIORITY.get(r["primary_source"], 0) > PRIORITY.get(best["primary_source"], 0):
            best = r
    return best


async def create_canonical(pool, raw: dict) -> dict:
    """Crea un canonical_event nuevo a partir de una lectura cruda."""
    row = await pool.fetchrow(
        """
        INSERT INTO canonical_events
            (occurred_at, latitude, longitude, depth_km, magnitude,
             region_text, primary_source, alert_level)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, occurred_at, latitude, longitude, depth_km,
                  magnitude, region_text, primary_source, alert_level
        """,
        raw["occurred_at"],
        raw["latitude"],
        raw["longitude"],
        raw.get("depth_km"),
        raw["magnitude"],
        raw.get("region_text"),
        raw["source"],
        alert_level(raw["magnitude"]),
    )
    await link_source(pool, row["id"], raw["id"])
    return dict(row)


async def link_source(pool, canonical_id, raw_event_id) -> None:
    """Enlaza una lectura cruda a un evento canónico (N:1)."""
    await pool.execute(
        """
        INSERT INTO event_sources (canonical_id, raw_event_id)
        VALUES ($1, $2)
        ON CONFLICT (canonical_id, raw_event_id) DO NOTHING
        """,
        canonical_id, raw_event_id,
    )


async def update_canonical(pool, canonical_id, raw: dict) -> None:
    """La fuente más confiable sobrescribe el canónico con sus valores."""
    await pool.execute(
        """
        UPDATE canonical_events
        SET latitude = $2, longitude = $3, depth_km = $4, magnitude = $5,
            region_text = $6, primary_source = $7, alert_level = $8,
            updated_at = now()
        WHERE id = $1
        """,
        canonical_id,
        raw["latitude"],
        raw["longitude"],
        raw.get("depth_km"),
        raw["magnitude"],
        raw.get("region_text"),
        raw["source"],
        alert_level(raw["magnitude"]),
    )


async def canonicalize(pool, raw: dict) -> dict | None:
    """Flujo completo de deduplicación.

    Devuelve el canonical_event cuando es NUEVO (debe publicarse en Redis),
    o None cuando se enlazó a un evento existente.
    """
    candidate = await find_candidate(
        pool, raw["occurred_at"], raw["latitude"], raw["longitude"], raw["magnitude"]
    )
    if candidate:
        await link_source(pool, candidate["id"], raw["id"])
        if PRIORITY.get(raw["source"], 0) > PRIORITY.get(candidate["primary_source"], 0):
            await update_canonical(pool, candidate["id"], raw)
        return None
    return await create_canonical(pool, raw)