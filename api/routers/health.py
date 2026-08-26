# -*- coding: utf-8 -*-
"""Healthcheck de los workers."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request

router = APIRouter(tags=["system"])


@router.get("/api/health")
async def health(request: Request):
    pool = request.app.state.pool

    workers = {}
    for src in ("usgs", "ssn", "sasmex"):
        last = await pool.fetchrow(
            """
            SELECT status, events_found, error_message, started_at
            FROM ingestion_runs
            WHERE source = $1
            ORDER BY started_at DESC
            LIMIT 1
            """,
            src,
        )
        if last:
            stale = datetime.now(timezone.utc) - last["started_at"] > timedelta(minutes=10)
            workers[src] = {
                "status": "error"
                if last["status"] == "error"
                else ("stale" if stale else "ok"),
                "last_started_at": last["started_at"],
                "events_found": last["events_found"],
                "error": last["error_message"],
            }
        else:
            workers[src] = {"status": "never_run"}

    return {"status": "ok", "workers": workers}