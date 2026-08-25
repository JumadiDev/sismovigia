# -*- coding: utf-8 -*-
"""Conexión a PostgreSQL/TimescaleDB para la API."""
import os

import asyncpg

DEFAULT_DSN = os.environ.get("DATABASE_URL", "postgresql://sismovigia:dev@localhost:5432/sismovigia")


async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(DEFAULT_DSN, min_size=1, max_size=4)