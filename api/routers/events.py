# -*- coding: utf-8 -*-

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/events", tags=["events"])

SELECT_COLS = """
    id, occurred_at, latitude, longitude, depth_km,
    magnitude, region_text, primary_source, alert_level
"""


@router.get("/recent")
async def recent_events(request: Request, hours: int = 24, limit: int = 100):
    """Eventos canónicos en la ventana solicitada (más recientes primero)."""
    rows = await request.app.state.pool.fetch(
        f"""
        SELECT {SELECT_COLS}
        FROM canonical_events
        WHERE occurred_at > now() - make_interval(hours => $1)
        ORDER BY occurred_at DESC
        LIMIT $2
        """,
        hours,
        limit,
    )
    return [dict(r) for r in rows]


@router.get("/{event_id}")
async def event_detail(request: Request, event_id: str):
    """Detalle de un evento, incluyendo sus fuentes (event_sources)."""
    row = await request.app.state.pool.fetchrow(
        f"""
        SELECT {SELECT_COLS}
        FROM canonical_events
        WHERE id = $1
        """,
        event_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="evento no encontrado")

    sources = await request.app.state.pool.fetch(
        """
        SELECT re.source, re.external_id, re.magnitude, re.depth_km, re.region_text, re.ingested_at
        FROM event_sources es
        JOIN raw_events re ON re.id = es.raw_event_id
        WHERE es.canonical_id = $1
        """,
        event_id,
    )
    return {**dict(row), "sources": [dict(s) for s in sources]}