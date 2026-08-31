# -*- coding: utf-8 -*-
"""Worker CIRES/SASMEX — boletín informativo.

Este worker NO escribe en canonical_events: los boletines de SASMEX no son
eventos geolocalizados. Solo detecta el boletín vigente de la página pública
de CIRES y lo guarda como news_items (tag SASMEX) para la sección de noticias.

Idempotencia: el boletín incluye una marca temporal única (fecha + hora local
del sismo) y un URL de reporte con el mismo timestamp. Se usa como external_id.

Página real inspeccionada (2026-08): `<p class=text-index mb-4>El día <b>19</b>
de <b>agosto</b> del <b>2026 </b> a las <b>20:56:32</b> hrs. (hora local) el
Sistema de Alerta Sísmica Mexicano (SASMEX®) detectó un sismo que No Ameritó
aviso de Alerta en la Ciudad de México.` — codificada en Latin-1/Win-1252.
"""
import argparse
import asyncio
import html as htmlmod
import os
import re
from datetime import datetime, timedelta, timezone

import httpx

from common import db as dbmod
from common.backoff import Backoff

CIRES_URL = os.environ.get("CIRES_URL", "http://www.cires.org.mx/")
USER_AGENT = os.environ.get(
    "USER_AGENT",
    "sismovigia/1.0 (educational open-source project; responsible access to public page)",
)
SOURCE = "sasmex"   # id del worker en ingestion_runs
NEWS_SOURCE = "cires"  # institución real que publica el boletín

# Horario de Ciudad de México: UTC-6 fijo (México sin DST desde 2022)
MX_OFFSET = timezone(timedelta(hours=-6))

MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11,
    "diciembre": 12,
}

_BULLETIN_RE = re.compile(
    r"El\s+d[íi]a\s+(\d{1,2})\s+de\s+([a-záéíóúüñ]+)\s+del\s+(\d{4})\s+"
    r"a\s+las\s+(\d{1,2}:\d{2}:\d{2})",
    re.IGNORECASE,
)
_REPORT_RE = re.compile(r"sasmex_reporte[^0-9]*?(\d{8})_(\d{6})", re.IGNORECASE)
_PARAGRAPH_RE = re.compile(r"<p[^>]*class=[\"']?text-index[^>]*>(.*?)</p>", re.S | re.I)


def strip_tags(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html)).strip()


def parse_bulletin(html: str) -> dict | None:
    """Extrae el boletín vigente de la página de CIRES. Devuelve dict o None."""
    if "Sistema de Alerta" not in html or "SASMEX" not in html:
        return None

    # Bloque principal del boletín (el marcado real intercala <b> y <br>)
    m = _PARAGRAPH_RE.search(html)
    text = strip_tags(m.group(1)) if m else strip_tags(html)

    m2 = _BULLETIN_RE.search(htmlmod.unescape(text))
    if not m2:
        return None
    day, month_name, year, hhmmss = m2.group(1), m2.group(2).lower(), m2.group(3), m2.group(4)
    month = MONTHS.get(month_name)
    if not month:
        return None

    naive = datetime(int(year), month, int(day), *[int(x) for x in hhmmss.split(":")])
    published = naive.replace(tzinfo=MX_OFFSET).astimezone(timezone.utc)

    # Timestamp del reporte/mapa (mismo evento) → external_id único
    m3 = _REPORT_RE.search(html)
    ts = f"{m3.group(1)}{m3.group(2)}" if m3 else published.strftime("%Y%m%d%H%M%S")

    body = text
    title = f"Boletín SASMEX · {published.day} {list(MONTHS)[published.month - 1]} {published.year} {published.strftime('%H:%M')} MX"
    return {
        "external_id": f"sasmex-{ts}",
        "source": NEWS_SOURCE,
        "tag": "SASMEX",
        "title": title,
        "body": body,
        "url": f"http://www.cires.org.mx/reportes_sasmex/sasmex_reporte_{ts[:8]}_{ts[8:]}_esn.php",
        "published_at": published,
    }


async def insert_news_item(pool, item: dict) -> bool:
    """Idempotente por external_id. Devuelve True si es nuevo."""
    row = await pool.fetchrow(
        """
        INSERT INTO news_items (source, tag, title, body, url, published_at, external_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (external_id) DO NOTHING
        RETURNING id
        """,
        item["source"], item["tag"], item["title"], item["body"],
        item["url"], item["published_at"], item["external_id"],
    )
    return row is not None


async def poll_sasmex(pool) -> tuple[int, int]:
    """Descarga la home de CIRES y guarda el boletín vigente si es nuevo.

    Devuelve (boletines_nuevos, boletines_vistos). Boletin_vistos: 1 si la
    página traía un boletín parseable, 0 si no.
    """
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        r = await client.get(CIRES_URL, headers={"User-Agent": USER_AGENT})
        r.raise_for_status()
        text = r.content.decode("latin-1", errors="replace")

    item = parse_bulletin(text)
    if not item:
        return 0, 0
    nuevo = await insert_news_item(pool, item)
    return 1 if nuevo else 0, 1


async def run_once(pool) -> None:
    started = datetime.now(timezone.utc)
    try:
        nuevos, vistos = await poll_sasmex(pool)
        await dbmod.log_run(pool, SOURCE, started, "ok", nuevos)
        print(f"[sasmex] ok · {vistos} boletín(es) · {nuevos} nuevo(s)")
    except Exception as exc:
        await dbmod.log_run(pool, SOURCE, started, "error", 0, str(exc))
        print(f"[sasmex] ERROR: {exc}")


async def run_forever(pool, base_delay: float) -> None:
    backoff = Backoff(base=base_delay, cap=600)
    while True:
        started = datetime.now(timezone.utc)
        try:
            nuevos, vistos = await poll_sasmex(pool)
            await dbmod.log_run(pool, SOURCE, started, "ok", nuevos)
            print(f"[sasmex] ok · {vistos} boletín(es) · {nuevos} nuevo(s)")
            delay = backoff.success()
        except Exception as exc:
            await dbmod.log_run(pool, SOURCE, started, "error", 0, str(exc))
            print(f"[sasmex] ERROR: {exc}")
            delay = backoff.failure()
        await asyncio.sleep(delay)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Worker CIRES/SASMEX (boletines → news_items)")
    parser.add_argument("--once", action="store_true", help="ejecuta una sola corrida y sale")
    parser.add_argument("--delay", type=float, default=600, help="intervalo base entre polls (seg)")
    args = parser.parse_args()

    pool = await dbmod.get_pool()
    try:
        if args.once:
            await run_once(pool)
        else:
            await run_forever(pool, args.delay)
    finally:
        await pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[sasmex] detenido")