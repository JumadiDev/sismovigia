# -*- coding: utf-8 -*-
"""Boletines de noticias sísmicas."""
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("")
async def news_list(request: Request, limit: int = 20):
    """Boletines más recientes de SASMEX/centros de alerta."""
    rows = await request.app.state.pool.fetch(
        """
        SELECT id, title, source, tag, url, body, published_at
        FROM news_items
        ORDER BY published_at DESC
        LIMIT $1
        """,
        limit,
    )
    return [dict(r) for r in rows]