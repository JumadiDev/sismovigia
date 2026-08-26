# -*- coding: utf-8 -*-
"""Publicación de eventos nuevos en Redis (canal events:new).

Base: sismovigia-backend
Redis se usa SOLO como bus de eventos; la fuente de verdad es PostgreSQL.
"""
import json
import os

import redis.asyncio as aioredis


class Publisher:
    """Envoltorio opcional del canal events:new.

    Si REDIS_URL no está definido, la publicación se ignora en silencio
    (permite correr workers sin Redis en desarrollo).
    """

    def __init__(self, url: str | None = None):
        self.url = url or os.environ.get("REDIS_URL")
        self.client = aioredis.from_url(self.url) if self.url else None

    async def publish_event(self, canonical: dict) -> None:
        if not self.client:
            return
        try:
            await self.client.publish("events:new", json.dumps(canonical, default=str))
        except Exception:
            # Nunca deja caer al worker por un problema de Redis
            pass

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()