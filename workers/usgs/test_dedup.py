# -*- coding: utf-8 -*-
"""Test de deduplicación cruzada: un SSN que reporta el MISMO sismo que USGS
debe enlazarse al mismo canonical_events (primary_source sigue siendo usgs)."""
import asyncio
import os
from datetime import timedelta

from common import db as dbmod
from common.dedup import canonicalize


async def main() -> None:
    pool = await dbmod.get_pool()
    try:
        # 1. Canonical existente (del worker USGS)
        c = await pool.fetchrow(
            "SELECT id, occurred_at, latitude, longitude, magnitude, primary_source "
            "FROM canonical_events ORDER BY occurred_at DESC LIMIT 1"
        )
        assert c, "no hay canonical_events (corre primero el worker usgs)"
        print(f"canonical existente: {c['id']} mag={c['magnitude']} src={c['primary_source']}")

        # 2. Insertar un raw_events simulado de SSN que describe el MISMO sismo
        #    (mismo lugar, +1 minuto, misma magnitud → dentro de las tolerancias)
        raw_id = await dbmod.upsert_raw_event(pool, {
            "source": "ssn",
            "external_id": "ssn-test-dup-001",
            "occurred_at": c["occurred_at"] + timedelta(minutes=1),
            "latitude": c["latitude"],
            "longitude": c["longitude"],
            "depth_km": 15.0,
            "magnitude": c["magnitude"],
            "region_text": "Simulado · mismo sismo que USGS",
            "raw_payload": {"test": True},
        })
        assert raw_id, "el raw ssn simulado no se insertó (¿ya existía?)"

        # 3. Canonicalizar
        result = await canonicalize(pool, {
            "id": raw_id,
            "source": "ssn",
            "occurred_at": c["occurred_at"] + timedelta(minutes=1),
            "latitude": c["latitude"],
            "longitude": c["longitude"],
            "depth_km": 15.0,
            "magnitude": c["magnitude"],
            "region_text": "Simulado · mismo sismo que USGS",
        })

        # 4. Verificaciones
        links = await pool.fetch(
            "SELECT canonical_id, raw_event_id FROM event_sources WHERE canonical_id = $1",
            c["id"],
        )
        updated = await pool.fetchrow(
            "SELECT primary_source FROM canonical_events WHERE id = $1", c["id"]
        )
        total = await pool.fetchval("SELECT count(*) FROM canonical_events")

        print(f"canonicalize() devolvió: {result}")
        print(f"enlaces para {c['id']}: {len(links)} (esperado: 2)")
        print(f"primary_source: {updated['primary_source']} (esperado: usgs)")
        print(f"total canonical_events: {total} (esperado: 1 — sin duplicado)")

        ok = (
            result is None
            and len(links) == 2
            and updated["primary_source"] == "usgs"
            and total == 1
        )
        print("\nRESULTADO:", "PASS ✅ deduplicación correcta" if ok else "FAIL ❌")
        raise SystemExit(0 if ok else 1)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())