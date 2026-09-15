# -*- coding: utf-8 -*-
"""Ruta WebSocket /ws/live.

Protocolo:
  snapshot       → {type, generated_at, events[], metrics, telemetry[]}
  event:new      → {type, data: canonical_event}
  telemetry:new  → {type, data: telemetry_sample}
"""
import asyncio
import json
import logging
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ws import ConnectionManager, build_snapshot, sender

router = APIRouter(tags=["live"])

log = logging.getLogger("sismovigia.ws")


def _json_default(o):
    if isinstance(o, (datetime, date, UUID, Decimal)):
        return str(o)
    raise TypeError(f"{type(o)} no serializable")


@router.websocket("/ws/live")
async def ws_live(ws: WebSocket):
    await ws.accept()

    # Rate limit por IP (SPEC-002 §13)
    if not ws.app.state.ws.check_rate_limit(ws):
        await ws.send_json({"type": "error", "data": "too many connections from this IP"})
        await ws.close(code=1013, reason="rate limit")
        return

    q = await ws.app.state.ws.connect(ws)
    send_task = asyncio.create_task(sender(ws, q))

    try:
        snapshot = await build_snapshot(ws.app.state.pool)
        await q.put(json.dumps(snapshot, default=_json_default, ensure_ascii=False))
    except Exception as exc:
        log.error("snapshot falló: %s", exc)

    try:
        while True:
            # Recibe pings y suscripciones del cliente; al desconectarse lanza WebSocketDisconnect.
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "subscribe:telemetry":
                station = msg.get("station")
                if station:
                    try:
                        rows = await ws.app.state.pool.fetch(
                            """
                            SELECT station_id, accel_x, accel_y, accel_z,
                                   temperature, rssi, battery_v, sampled_at
                            FROM telemetry
                            WHERE station_id = $1
                            ORDER BY sampled_at DESC
                            LIMIT 400
                            """,
                            station,
                        )
                        telem = [dict(r) for r in reversed(rows)]
                        await q.put(
                            json.dumps(
                                {"type": "snapshot:telemetry", "station": station, "telemetry": telem},
                                default=_json_default,
                                ensure_ascii=False,
                            )
                        )
                    except Exception as exc:
                        log.error("snapshot telemetría falló: %s", exc)
    except WebSocketDisconnect:
        pass
    finally:
        ws.app.state.ws.disconnect(ws)
        send_task.cancel()
        try:
            await send_task
        except (asyncio.CancelledError, Exception):
            pass