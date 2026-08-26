# -*- coding: utf-8 -*-
"""Capa IoT para el panel: estaciones y telemetría."""
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["iot"])


@router.get("/stations")
async def stations(request: Request):
    """Estaciones con estado y conteo de muestras en 24 h."""
    rows = await request.app.state.pool.fetch(
        """
        SELECT s.id, s.name, s.location, s.latitude, s.longitude,
               s.firmware, s.status, s.last_seen,
               (SELECT count(*) FROM telemetry t
                 WHERE t.station_id = s.id
                   AND t.sampled_at > now() - interval '24 hours') AS samples_24h
        FROM stations s
        ORDER BY s.id
        """
    )
    return [dict(r) for r in rows]


@router.get("/telemetry/recent")
async def telemetry_recent(request: Request, station: str = "SX-002", limit: int = 300):
    """Últimas lecturas de aceleración de una estación (para sismógrafo)."""
    rows = await request.app.state.pool.fetch(
        """
        SELECT station_id, accel_x, accel_y, accel_z,
               temperature, rssi, battery_v, sampled_at
        FROM telemetry
        WHERE station_id = $1
        ORDER BY sampled_at DESC
        LIMIT $2
        """,
        station,
        min(limit, 1000),
    )
    return [dict(r) for r in reversed(rows)]