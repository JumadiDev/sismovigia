# -*- coding: utf-8 -*-
"""Conexión a PostgreSQL/TimescaleDB y helpers de escritura compartidos.

Base: sismovigia-backend
"""
import os
import json

import asyncpg

DEFAULT_DSN = os.environ.get("DATABASE_URL", "postgresql://sismovigia:dev@localhost:5432/sismovigia")


async def get_pool(dsn: str | None = None, max_size: int = 4) -> asyncpg.Pool:
    """Crea un pool de conexiones (reutilizable por API y workers)."""
    return await asyncpg.create_pool(dsn or DEFAULT_DSN, min_size=1, max_size=max_size)


async def upsert_raw_event(pool: asyncpg.Pool, ev: dict) -> int | None:
    """Inserta una lectura cruda de una fuente. Idempotente por
    UNIQUE (source, external_id, occurred_at).

    Devuelve el id si se insertó (nuevo), o None si ya existía.
    """
    payload = ev.get("raw_payload")
    if isinstance(payload, (dict, list)):
        payload = json.dumps(payload, default=str)

    row = await pool.fetchrow(
        """
        INSERT INTO raw_events
            (source, external_id, occurred_at, latitude, longitude,
             depth_km, magnitude, mag_type, region_text, raw_payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        ON CONFLICT (source, external_id, occurred_at) DO NOTHING
        RETURNING id
        """,
        ev["source"],
        ev["external_id"],
        ev["occurred_at"],
        ev["latitude"],
        ev["longitude"],
        ev.get("depth_km"),
        ev["magnitude"],
        ev.get("mag_type"),
        ev.get("region_text"),
        payload,
    )
    return row["id"] if row else None


async def log_run(
    pool: asyncpg.Pool,
    source: str,
    started_at,
    status: str,
    events_found: int = 0,
    error_message: str | None = None,
) -> None:
    """Registra una corrida (éxito o fallo) en ingestion_runs. Nunca falla en silencio."""
    await pool.execute(
        """
        INSERT INTO ingestion_runs
            (source, started_at, finished_at, status, events_found, error_message)
        VALUES ($1, $2, now(), $3, $4, $5)
        """,
        source, started_at, status, events_found, error_message,
    )