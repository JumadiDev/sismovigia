# -*- coding: utf-8 -*-

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import create_pool
from routers import events, health, iot, metrics, news, notifications, ws as ws_router
from services.notification import init_firebase
from ws import ConnectionManager, redis_listener


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await create_pool()
    app.state.ws = ConnectionManager()
    init_firebase()
    listener = asyncio.create_task(redis_listener(app))
    try:
        yield
    finally:
        listener.cancel()
        try:
            await listener
        except asyncio.CancelledError:
            pass
        await app.state.pool.close()


app = FastAPI(
    title="SISMOVIGÍA API",
    description="Monitoreo sísmico de México — datos reales de SSN/USGS + IoT",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS: en producción restringir al dominio del frontend (SPEC-002 §13)
# En desarrollo local permite todo. Configurar CORS_ORIGINS en .env para producción.
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",") if os.environ.get("CORS_ORIGINS") else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"name": "SISMOVIGÍA API", "version": app.version, "docs": "/docs"}


app.include_router(health.router)
app.include_router(events.router)
app.include_router(metrics.router)
app.include_router(news.router)
app.include_router(iot.router)
app.include_router(notifications.router)
app.include_router(ws_router.router)