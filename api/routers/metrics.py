# -*- coding: utf-8 -*-
"""Métricas en vivo."""
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


def alert_level(mag: float) -> str:
    if mag >= 6.0:
        return "alerta"
    if mag >= 4.5:
        return "precaucion"
    return "normal"


@router.get("/live")
async def metrics_live(request: Request):
    """Métricas actuales: ventana 24h sobre canonical_events + estado de estaciones IoT."""
    pool = request.app.state.pool

    events_24h = await pool.fetchval(
        "SELECT count(*) FROM canonical_events WHERE occurred_at > now() - interval '24 hours'"
    )
    max_ev = await pool.fetchrow(
        """
        SELECT magnitude, region_text
        FROM canonical_events
        WHERE occurred_at > now() - interval '24 hours'
        ORDER BY magnitude DESC
        LIMIT 1
        """
    )
    avg_depth = await pool.fetchval(
        "SELECT round(avg(depth_km)::numeric, 1) FROM canonical_events "
        "WHERE occurred_at > now() - interval '24 hours'"
    )

    stations = await pool.fetchrow(
        "SELECT count(*) AS total, "
        "coalesce(count(*) FILTER (WHERE status = 'online'), 0) AS online "
        "FROM stations"
    )

    # Última ventana del agregado continuo (refleja la política de 5 min)
    last_bucket = await pool.fetchrow(
        "SELECT bucket, event_count, max_magnitude, avg_depth FROM metrics_5min "
        "ORDER BY bucket DESC LIMIT 1"
    )

    max_mag = max_ev["magnitude"] if max_ev else None
    return {
        "window_hours": 24,
        "events_24h": events_24h,
        "max_magnitude": max_mag,
        "max_region": max_ev["region_text"] if max_ev else None,
        "alert_level": alert_level(max_mag) if max_mag is not None else "normal",
        "avg_depth_km": avg_depth,
        "stations": {
            "online": stations["online"],
            "total": stations["total"],
        },
        "continuous_5min": dict(last_bucket) if last_bucket else None,
    }