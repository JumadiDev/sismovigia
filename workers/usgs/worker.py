# -*- coding: utf-8 -*-
"""Worker de ingesta USGS (fuente primaria).

Base: sismovigia-backend
- Polling al FDSN Event Web Service cada 60s (respeta la caché de USGS).
- BBOX México: 14–33°N, −119…−86°E.
- Idempotente: UNIQUE (source, external_id, occurred_at) evita duplicados.
- Publica eventos canónicos NUEVOS en Redis (canal events:new).
"""
import argparse
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone

import httpx

from common import db as dbmod
from common.backoff import Backoff
from common.dedup import canonicalize
from common.pubsub import Publisher

USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
BBOX_MEXICO = dict(minlatitude=14.0, maxlatitude=33.0, minlongitude=-119.0, maxlongitude=-86.0)
USER_AGENT = os.environ.get(
    "USER_AGENT",
    "sismovigia/1.0 (proyecto educativo open-source; contacto via github)",
)

SOURCE = "usgs"


async def poll_usgs(pool, publisher: Publisher, since: datetime) -> tuple[int, int]:
    """Consulta el feed, ingiere lecturas crudas y canonicaliza.

    Devuelve (total_encontrados, canónicos_nuevos).
    """
    params = {
        "format": "geojson",
        "starttime": since.isoformat(),
        "minmagnitude": 2.5,
        "orderby": "time",
        **BBOX_MEXICO,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(USGS_URL, params=params, headers={"User-Agent": USER_AGENT})
        r.raise_for_status()
        data = r.json()

    total = len(data.get("features", []))
    nuevos = 0
    for feat in data.get("features", []):
        p = feat["properties"]
        lon, lat, depth = feat["geometry"]["coordinates"]

        raw_id = await dbmod.upsert_raw_event(
            pool,
            {
                "source": SOURCE,
                "external_id": feat["id"],
                "occurred_at": datetime.fromtimestamp(p["time"] / 1000, tz=timezone.utc),
                "latitude": lat,
                "longitude": lon,
                "depth_km": depth,
                "magnitude": p["mag"],
                "mag_type": p.get("magType"),
                "region_text": p.get("place"),
                "raw_payload": json.dumps(feat),
            },
        )
        if raw_id is None:
            continue  # ya estaba en la base (idempotente)

        canonical = await canonicalize(
            pool,
            {
                "id": raw_id,
                "source": SOURCE,
                "occurred_at": datetime.fromtimestamp(p["time"] / 1000, tz=timezone.utc),
                "latitude": lat,
                "longitude": lon,
                "depth_km": depth,
                "magnitude": p["mag"],
                "region_text": p.get("place"),
            },
        )
        if canonical:
            await publisher.publish_event(canonical)
            nuevos += 1
    return total, nuevos


async def run_once(pool, publisher: Publisher, hours: float) -> None:
    """Una sola corrida (útil para pruebas / modo --once)."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    started = datetime.now(timezone.utc)
    try:
        total, nuevos = await poll_usgs(pool, publisher, since)
        await dbmod.log_run(pool, SOURCE, started, "ok", total)
        print(f"[usgs] ok · {total} encontrados · {nuevos} nuevos canónicos")
    except Exception as exc:
        await dbmod.log_run(pool, SOURCE, started, "error", 0, str(exc))
        print(f"[usgs] ERROR: {exc}")


async def run_forever(pool, publisher: Publisher, base_delay: float, hours: float) -> None:
    """Bucle continuo con backoff (SPEC-002 §12)."""
    backoff = Backoff(base=base_delay, cap=600)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    while True:
        started = datetime.now(timezone.utc)
        try:
            total, nuevos = await poll_usgs(pool, publisher, since)
            since = started
            await dbmod.log_run(pool, SOURCE, started, "ok", total)
            print(f"[usgs] ok · {total} encontrados · {nuevos} nuevos canónicos")
            delay = backoff.success()
        except Exception as exc:
            await dbmod.log_run(pool, SOURCE, started, "error", 0, str(exc))
            print(f"[usgs] ERROR: {exc}")
            delay = backoff.failure()

        await asyncio.sleep(delay)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Worker de ingesta USGS (México)")
    parser.add_argument("--once", action="store_true", help="ejecuta una sola corrida y sale")
    parser.add_argument("--delay", type=float, default=60, help="intervalo base entre polls (seg)")
    parser.add_argument("--hours", type=float, default=1, help="ventana inicial hacia atrás (horas)")
    args = parser.parse_args()

    pool = await dbmod.get_pool()
    publisher = Publisher()
    try:
        if args.once:
            await run_once(pool, publisher, args.hours)
        else:
            await run_forever(pool, publisher, args.delay, args.hours)
    finally:
        await publisher.close()
        await pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[usgs] detenido")