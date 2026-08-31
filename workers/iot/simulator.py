# -*- coding: utf-8 -*-
"""Simulador IoT — publica telemetría sintética de estaciones en MQTT (DEMO).

Genera ruido ambiental (dos senoides de baja frecuencia + jitter de forma periódica, un sismo sintético:
durante ~10 s un impulso proporcional a la distancia al epicentro se suma a la
aceleración de cada estación. Publica en:
  sismex/<id>/telemetry  sismex/<id>/status  sismex/<id>/alarm

Es una herramienta de desarrollo para alimentar la tubería MQTT→DB→panel.
Se ejecuta con el perfil de compose "sim".
"""
import argparse
import asyncio
import json
import math
import os
import random
from datetime import datetime, timezone

from asyncio_mqtt import Client as MqttClient

MQTT_HOST = os.environ.get("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
TOPIC_PREFIX = os.environ.get("MQTT_TOPIC_PREFIX", "sismex")

STATIONS = [
    {"id": "SX-001", "lat": 16.44, "lon": -95.02},
    {"id": "SX-002", "lat": 19.42, "lon": -99.16},
    {"id": "SX-003", "lat": 16.96, "lon": -100.08},
    {"id": "SX-004", "lat": 17.06, "lon": -96.72},
    {"id": "SX-005", "lat": 21.51, "lon": -104.89},
    {"id": "SX-006", "lat": 20.97, "lon": -89.62},
]


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    return 2 * r * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))


class Quake:
    """Sismo sintético en curso: epicentro + tiempo de inicio + magnitud."""

    def __init__(self):
        self.lat = random.uniform(14.5, 20.5)
        self.lon = random.uniform(-104.5, -92.5)
        self.mag = random.uniform(4.0, 6.4)
        self.t0 = None  # marcado por el loop

    def accel(self, lat, lon, t_elapsed):
        if self.t0 is None:
            return 0.0
        if t_elapsed < 0 or t_elapsed > 10:
            return 0.0
        dist = haversine_km(lat, lon, self.lat, self.lon)
        peak = 0.05 + self.mag * 0.02 * math.exp(-dist / 90.0)
        # pulso con ataque/decaimiento suaves
        env = math.sin(math.pi * t_elapsed / 10) ** 2
        return peak * env * math.sin(2 * math.pi * 2.4 * t_elapsed)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Simulador IoT de estaciones sísmicas (DEMO)")
    parser.add_argument("--hz", type=float, default=10, help="muestras/seg por estación")
    parser.add_argument("--host", default=MQTT_HOST)
    parser.add_argument("--port", type=int, default=MQTT_PORT)
    args = parser.parse_args()

    interval = 1.0 / args.hz
    quake = Quake()
    next_quake = asyncio.get_event_loop().time() + random.uniform(60, 240)

    async with MqttClient(args.host, port=args.port, clean_session=True) as client:
        print(f"[sim-iot] conectado a {args.host}:{args.port} · {len(STATIONS)} estaciones @ {args.hz} Hz")

        # Estado inicial de cada estación
        for s in STATIONS:
            await client.publish(
                f"{TOPIC_PREFIX}/{s['id']}/status",
                json.dumps({"status": "online", "firmware": "2.1.4", "battery_v": round(random.uniform(3.4, 4.1), 2)}),
            )

        t0 = asyncio.get_event_loop().time()
        while True:
            now = asyncio.get_event_loop().time()
            t = now - t0

            if now >= next_quake:
                quake = Quake()
                quake.t0 = now
                next_quake = now + random.uniform(60, 240)
                print(f"[sim-iot] SISMO sintético M{quake.mag:.1f} ({quake.lat:.1f}, {quake.lon:.1f})")
                for s in STATIONS:
                    d = haversine_km(s["lat"], s["lon"], quake.lat, quake.lon)
                    if d < 200:
                        await client.publish(
                            f"{TOPIC_PREFIX}/{s['id']}/alarm",
                            json.dumps({"level": "precaucion", "message": f"Sismo sintético M{quake.mag:.1f}", "magnitude": round(quake.mag, 1)}),
                        )

            for s in STATIONS:
                elapsed = now - quake.t0 if quake.t0 else -999
                imp = quake.accel(s["lat"], s["lon"], elapsed)
                noise = 0.008 * math.sin(2 * math.pi * 0.35 * t) + 0.006 * math.sin(2 * math.pi * 1.7 * t)
                payload = {
                    "accel_x": round(noise + 0.2 * imp + random.uniform(-0.004, 0.004), 5),
                    "accel_y": round(noise + 0.15 * imp + random.uniform(-0.004, 0.004), 5),
                    "accel_z": round(1.0 + 0.02 * imp + random.uniform(-0.002, 0.002), 5),
                    "temperature": round(random.uniform(24, 38), 1),
                    "rssi": random.randint(-95, -45),
                    "battery_v": round(random.uniform(3.4, 4.1), 2),
                    "sampled_at": datetime.now(timezone.utc).isoformat(),
                }
                await client.publish(f"{TOPIC_PREFIX}/{s['id']}/telemetry", json.dumps(payload))
            await asyncio.sleep(interval)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[sim-iot] detenido")