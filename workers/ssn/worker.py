# -*- coding: utf-8 -*-
"""Worker de ingesta SSN (fuente secundaria, scraping respetuoso).

Base: sismovigia-backend-SPEC-002.md §7.2

ADVERTENCIA (SPEC-002): esta página es HTML pensado para humanos, no un
contrato de API — su estructura puede cambiar sin aviso. El parseo es
deliberadamente defensivo: cada fila fallida se ignora, cada corrida se
registra en ingestion_runs, y un cambio de estructura nunca tumba el worker.
"""
import argparse
import asyncio
import hashlib
import os
import re
from datetime import datetime, timezone

import httpx

from common import db as dbmod
from common.backoff import Backoff
from common.dedup import canonicalize
from common.pubsub import Publisher

SSN_URL = os.environ.get("SSN_URL", "http://www.ssn.unam.mx/sismicidad/ultimos/")
USER_AGENT = os.environ.get(
    "USER_AGENT",
    "sismovigia/1.0 (educational open-source project; responsible access to public page)",
)
SOURCE = "ssn"

# Contador de corridas consecutivas sin filas parseadas.
# Si llega a 3, probablemente la estructura HTML cambió (SPEC-002 §7.2).
_consecutive_empty = 0
EMPTY_THRESHOLD = 3


def safe_float(text: str) -> float | None:
    m = re.search(r"-?\d+\.?\d*", str(text).replace(",", ".").strip())
    if not m:
        return None
    try:
        return float(m.group())
    except ValueError:
        return None


def parse_ssn_cell(loc: str) -> tuple[float, float] | None:
    """Extrae (lat, lon) del texto de epicentro.

    Formato vigente: '140 km al SUROESTE de CD HIDALGO, CHIS: 14.098°, -93.302°'
    Toma los dos últimos números decimales del texto (robusto a cambios de etiqueta).
    """
    nums = re.findall(r"-?\d+\.\d+", loc)
    if len(nums) < 2:
        return None
    return float(nums[-2]), float(nums[-1])


def parse_ssn_rows(cells: list[str]) -> dict | None:
    """Convierte una fila de la tabla del SSN en un dict normalizado."""
    if len(cells) < 4:
        return None

    mag = safe_float(cells[0])
    dt = cells[1].replace("&nbsp;", " ").strip()
    loc = cells[2]
    prof = safe_float(cells[3])

    if mag is None or prof is None:
        return None
    try:
        occurred_at = datetime.strptime(dt, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None

    latlon = parse_ssn_cell(loc)
    if latlon is None:
        return None
    lat, lon = latlon

    # Referencia humana ('140 km al SUROESTE de CD HIDALGO, CHIS') = parte antes del lat/lon
    ref = re.split(r":\s*-?\d", loc)[0].strip()

    # SSN no da id estable → hash determinista de la fila (SPEC-002 §7.2)
    external_id = hashlib.md5(f"{occurred_at.isoformat()}|{lat}|{lon}|{mag}".encode()).hexdigest()[:20]

    return {
        "source": SOURCE,
        "external_id": "ssn-" + external_id,
        "occurred_at": occurred_at,
        "latitude": lat,
        "longitude": lon,
        "depth_km": prof,
        "magnitude": mag,
        "mag_type": None,
        "region_text": ref,
    }


def parse_html(text: str) -> list[dict]:
    """Extrae todas las filas válidas de la tabla pública (parseo sin HTMLParser)."""
    html = text.decode("utf-8", errors="replace")
    events = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        clean = [re.sub(r"<[^>]+>", "", c).replace("&nbsp;", " ").strip() for c in cells]
        ev = parse_ssn_rows(clean)
        if ev:
            events.append(ev)
    return events


async def poll_ssn(pool, publisher: Publisher) -> tuple[int, int]:
    """Descarga, parsea e ingiere. Devuelve (filas_parseadas, canónicos_nuevos)."""
    global _consecutive_empty
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        r = await client.get(SSN_URL, headers={"User-Agent": USER_AGENT})
        r.raise_for_status()
        events = parse_html(r.content)

    if not events:
        _consecutive_empty += 1
        if _consecutive_empty >= EMPTY_THRESHOLD:
            raise RuntimeError(
                f"posible cambio de estructura HTML en SSN: "
                f"{_consecutive_empty} corridas consecutivas sin filas parseadas. "
                f"Verificar manualmente {SSN_URL}"
            )
    else:
        _consecutive_empty = 0

    nuevos = 0
    for ev in events:
        raw_id = await dbmod.upsert_raw_event(pool, {**ev, "raw_payload": ev})
        if raw_id is None:
            continue
        canonical = await canonicalize(pool, {**ev, "id": raw_id})
        if canonical:
            await publisher.publish_event(canonical)
            nuevos += 1
    return len(events), nuevos


async def run_once(pool, publisher: Publisher) -> None:
    started = datetime.now(timezone.utc)
    try:
        parsed, nuevos = await poll_ssn(pool, publisher)
        await dbmod.log_run(pool, SOURCE, started, "ok", parsed)
        print(f"[ssn] ok · {parsed} filas parseadas · {nuevos} nuevos canónicos")
    except Exception as exc:
        await dbmod.log_run(pool, SOURCE, started, "error", 0, str(exc))
        print(f"[ssn] ERROR: {exc}")


async def run_forever(pool, publisher: Publisher, base_delay: float) -> None:
    backoff = Backoff(base=base_delay, cap=600)
    while True:
        started = datetime.now(timezone.utc)
        try:
            parsed, nuevos = await poll_ssn(pool, publisher)
            await dbmod.log_run(pool, SOURCE, started, "ok", parsed)
            print(f"[ssn] ok · {parsed} filas parseadas · {nuevos} nuevos canónicos")
            delay = backoff.success()
        except Exception as exc:
            await dbmod.log_run(pool, SOURCE, started, "error", 0, str(exc))
            print(f"[ssn] ERROR: {exc}")
            delay = backoff.failure()
        await asyncio.sleep(delay)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Worker de ingesta SSN (UNAM, México)")
    parser.add_argument("--once", action="store_true", help="ejecuta una sola corrida y sale")
    parser.add_argument("--delay", type=float, default=300, help="intervalo base entre polls (seg)")
    args = parser.parse_args()

    pool = await dbmod.get_pool()
    publisher = Publisher()
    try:
        if args.once:
            await run_once(pool, publisher)
        else:
            await run_forever(pool, publisher, args.delay)
    finally:
        await publisher.close()
        await pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[ssn] detenido")