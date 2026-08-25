# -*- coding: utf-8 -*-
"""WebSocket en vivo: snapshot inicial + reenvío del canal Redis events:new.

Diseño:
- Un solo suscriptor a Redis para toda la app; cada conexión WS tiene una
  cola asyncio y un task emisor (evita escrituras concurrentes en el socket).
- El listener no depende de la DB: solo reenvía lo que publican los workers.
"""
import asyncio
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import WebSocket

log = logging.getLogger("sismovigia.ws")

CHANNEL = os.environ.get("REDIS_CHANNEL", "events:new")
MAX_CONNECTIONS_PER_IP = int(os.environ.get("WS_MAX_CONN_PER_IP", "5"))


class ConnectionManager:
    """Registra conexiones WS y difunde mensajes a todas las colas.
    Incluye rate limit básico por IP (SPEC-002 §13).
    """

    def __init__(self) -> None:
        self._queues: dict[WebSocket, asyncio.Queue] = {}
        self._ip_count: dict[str, int] = defaultdict(int)

    @property
    def connected(self) -> int:
        return len(self._queues)

    def _client_ip(self, ws: WebSocket) -> str:
        return ws.client.host if ws.client else "unknown"

    def check_rate_limit(self, ws: WebSocket) -> bool:
        """Devuelve True si la conexión está permitida, False si excede el límite."""
        ip = self._client_ip(ws)
        if self._ip_count[ip] >= MAX_CONNECTIONS_PER_IP:
            return False
        self._ip_count[ip] += 1
        return True

    async def connect(self, ws: WebSocket) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues[ws] = q
        return q

    def disconnect(self, ws: WebSocket) -> None:
        ip = self._client_ip(ws)
        self._queues.pop(ws, None)
        self._ip_count[ip] = max(0, self._ip_count[ip] - 1)

    def broadcast(self, message: dict) -> None:
        text = json.dumps(message, default=str)
        for ws, q in list(self._queues.items()):
            try:
                q.put_nowait(text)
            except asyncio.QueueFull:
                # Cliente lento: se descarta lo viejo para no atascarse
                try:
                    q.get_nowait()
                    q.put_nowait(text)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass


async def sender(ws: WebSocket, q: asyncio.Queue) -> None:
    """Drena la cola de la conexión y envía cada mensaje como texto JSON."""
    while True:
        text = await q.get()
        try:
            await ws.send_text(text)
        except Exception:
            break


async def redis_listener(app) -> None:
    """Suscriptor único a events:new → broadcast a todas las conexiones."""
    url = os.environ.get("REDIS_URL")
    if not url:
        log.warning("REDIS_URL no definido: /ws/live solo enviará snapshots")
        return
    client = aioredis.from_url(url, decode_responses=True)
    while True:
        try:
            async with client.pubsub() as pubsub:
                await pubsub.subscribe(CHANNEL)
                async for msg in pubsub.listen():
                    if msg.get("type") != "message":
                        continue
                    try:
                        data = json.loads(msg["data"])
                    except (TypeError, json.JSONDecodeError):
                        continue
                    app.state.ws.broadcast({"type": "event:new", "data": data})
                    # Push notification para alertas y precauciones
                    try:
                        from services.notification import send_push, is_initialized
                        if is_initialized() and data.get("alert_level") in ("alerta", "precaucion"):
                            level_label = "ALERTA SÍSMICA" if data["alert_level"] == "alerta" else "PRECAUCIÓN"
                            mag = data.get("magnitude", 0)
                            region = data.get("region_text", "desconocida")
                            await send_push(
                                pool=app.state.pool,
                                title=f"{level_label} — M{mag:.1f}",
                                body=f"Sismo en {region}. Profundidad: {data.get('depth_km', '?')} km",
                                data={
                                    "event_id": str(data.get("id", "")),
                                    "magnitude": str(mag),
                                    "alert_level": data["alert_level"],
                                },
                                alert_level=data["alert_level"],
                            )
                    except Exception as exc:
                        log.debug("Push no enviado: %s", exc)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.error("redis_listener: %s", exc)
            await asyncio.sleep(5)


async def build_snapshot(pool) -> dict:
    """Instantánea inicial: eventos recientes + métricas en vivo."""
    events = await pool.fetch(
        """
        SELECT id, occurred_at, latitude, longitude, depth_km,
               magnitude, region_text, primary_source, alert_level
        FROM canonical_events
        WHERE occurred_at > now() - interval '24 hours'
        ORDER BY occurred_at DESC
        LIMIT 50
        """
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
    stations = await pool.fetchrow(
        "SELECT count(*) AS total, "
        "coalesce(count(*) FILTER (WHERE status = 'online'), 0) AS online "
        "FROM stations"
    )
    news = await pool.fetch(
        """
        SELECT id, title, source, tag, url, published_at
        FROM news_items
        ORDER BY published_at DESC
        LIMIT 10
        """
    )
    max_mag = max_ev["magnitude"] if max_ev else None
    return {
        "type": "snapshot",
        "generated_at": datetime.now(timezone.utc),
        "events": [dict(e) for e in events],
        "news": [dict(n) for n in news],
        "metrics": {
            "events_24h": len(events),
            "max_magnitude": max_mag,
            "max_region": max_ev["region_text"] if max_ev else None,
            "alert_level": (
                "alerta" if (max_mag or 0) >= 6.0
                else "precaucion" if (max_mag or 0) >= 4.5
                else "normal"
            ),
            "stations": {"online": stations["online"], "total": stations["total"]},
        },
    }