# -*- coding: utf-8 -*-
"""Worker IoT — suscriptor MQTT que persiste telemetría de estaciones sísmicas.

Base: sismovigia-backend + extensión IoT del proyecto.

Tópicos (mockup + .env):
  sismex/<station>/telemetry   → JSON: accel_x, accel_y, accel_z (g), temperature,
                                 rssi, battery_v, sampled_at (ISO 8601)
  sismex/<station>/status      → JSON: { status, firmware?, battery_v? }
  sismex/<station>/alarm       → JSON: { message, level?, magnitude? }

Diseño:
- Un único suscriptor asyncio (asyncio-mqtt).
- El escritor agrupa lecturas en lotes (bulk INSERT) para no saturar la DB.
- Idempotente por UNIQUE (station_id, sampled_at).
"""
import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import asyncpg
from asyncio_mqtt import Client as MqttClient
from common import db as dbmod

log = logging.getLogger("sismovigia.iot")

MQTT_HOST = os.environ.get("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
TOPIC_PREFIX = os.environ.get("MQTT_TOPIC_PREFIX", "sismex")
BATCH_SIZE = int(os.environ.get("IOT_BATCH_SIZE", "200"))
BATCH_INTERVAL = float(os.environ.get("IOT_BATCH_INTERVAL", "2.0"))  # segundos


def parse_payload(raw: bytes) -> dict | None:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def topic_matches(topic, pattern: str) -> bool:
    """Coincidencia de tópico MQTT con wildcard '+': sismex/+/telemetry."""
    tp, pp = str(topic).split("/"), pattern.split("/")
    if len(tp) != len(pp):
        return False
    return all(p == "+" or p == t for p, t in zip(pp, tp))


class TelemetryWriter:
    """Buffer + bulk writer idempotente sobre la hipertabla telemetry."""

    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
        self.buffer: list[tuple] = []
        self.updated: set[str] = set()

    def push_telemetry(self, station_id: str, data: dict) -> None:
        try:
            sampled_at = datetime.fromisoformat(data.get("sampled_at", "").replace("Z", "+00:00"))
            if sampled_at.tzinfo is None:
                sampled_at = sampled_at.replace(tzinfo=timezone.utc)
        except ValueError:
            return
        self.buffer.append((
            station_id,
            float(data["accel_x"]), float(data["accel_y"]), float(data["accel_z"]),
            data.get("temperature"), data.get("rssi"), data.get("battery_v"),
            sampled_at,
        ))
        self.updated.add(station_id)

    def push_status(self, station_id: str, data: dict) -> None:
        status = data.get("status", "online")
        self.updated.add(station_id)
        # Se procesa en el flush para no bloquear el loop MQTT
        self._pending_status = getattr(self, "_pending_status", {})
        self._pending_status[station_id] = status

    async def flush(self) -> None:
        if not self.buffer and not getattr(self, "_pending_status", {}):
            return
        buffer, self.buffer = self.buffer, []
        pending = getattr(self, "_pending_status", {})
        self._pending_status = {}

        if pending:
            for sid, status in pending.items():
                await self.pool.execute(
                    """
                    UPDATE stations SET status = $2, last_seen = now()
                    WHERE id = $1
                    """,
                    sid, status,
                )

        if buffer:
            await self.pool.executemany(
                """
                INSERT INTO telemetry
                    (station_id, accel_x, accel_y, accel_z, temperature, rssi, battery_v, sampled_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (station_id, sampled_at) DO NOTHING
                """,
                buffer,
            )
            # La telemetría implica que la estación sigue viva
            station_ids = list({b[0] for b in buffer})
            await self.pool.execute(
                "UPDATE stations SET last_seen = now() WHERE id = ANY($1::text[])",
                station_ids,
            )


async def main() -> None:
    parser = argparse.ArgumentParser(description="Worker IoT — suscriptor MQTT → telemetry")
    parser.add_argument("--host", default=MQTT_HOST, help="host del broker MQTT")
    parser.add_argument("--port", type=int, default=MQTT_PORT, help="puerto del broker")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="[iot] %(message)s")
    pool = await dbmod.get_pool()
    writer = TelemetryWriter(pool)

    topics = [
        f"{TOPIC_PREFIX}/+/telemetry",
        f"{TOPIC_PREFIX}/+/status",
        f"{TOPIC_PREFIX}/+/alarm",
    ]

    async def on_message(station_id, kind, data: dict):
        if kind == "telemetry":
            writer.push_telemetry(station_id, data)
        elif kind == "status":
            writer.push_status(station_id, data)
        elif kind == "alarm":
            log.info("ALARMA %s: %s", station_id, data.get("message"))

    async with MqttClient(args.host, port=args.port, clean_session=True) as client:
        await client.subscribe([(t, 0) for t in topics])
        log.info("suscrito a %s", ", ".join(topics))

        async def consumer():
            async with client.messages() as messages:
                async for msg in messages:
                    if not any(topic_matches(msg.topic, t) for t in topics):
                        continue
                    station_id = str(msg.topic).split("/")[1]
                    kind = str(msg.topic).split("/")[2]
                    data = parse_payload(msg.payload)
                    if data:
                        await on_message(station_id, kind, data)

        consumer_task = asyncio.create_task(consumer())
        last_flush = asyncio.get_event_loop().time()
        try:
            while True:
                await asyncio.sleep(0.05)
                now = asyncio.get_event_loop().time()
                if now - last_flush >= BATCH_INTERVAL or len(writer.buffer) >= BATCH_SIZE:
                    await writer.flush()
                    last_flush = now
        finally:
            consumer_task.cancel()
            await writer.flush()
            await pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[iot] detenido")