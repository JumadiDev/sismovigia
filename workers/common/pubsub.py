# -*- coding: utf-8 -*-
"""Publicación de eventos nuevos y telemetría en Redis.

Base: sismovigia-backend
Redis se usa SOLO como bus de eventos; la fuente de verdad es PostgreSQL.
Canales:
  events:new       → eventos sísmicos canónicos
  telemetry:new    → lecturas de aceleración de estaciones IoT
"""
import json
import os

import redis.asyncio as aioredis


class Publisher:
    """Envoltorio opcional de los canales events:new y telemetry:new.

    Si REDIS_URL no está definido, la publicación se ignora en silencio
    (permite correr workers sin Redis en desarrollo).
    """

    def __init__(self, url: str | None = None):
        self.url = url or os.environ.get("REDIS_URL")
        self.client = aioredis.from_url(self.url) if self.url else None

    async def publish_event(self, canonical: dict) -> None:
        await self._publish("events:new", canonical)

    async def publish_telemetry(self, sample: dict) -> None:
        await self._publish("telemetry:new", sample)

    async def _publish(self, channel: str, payload: dict) -> None:
        if not self.client:
            return
        try:
            await self.client.publish(channel, json.dumps(payload, default=str))
        except Exception:
            # Nunca deja caer al worker por un problema de Redis
            pass

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()