# -*- coding: utf-8 -*-
"""Rutas de suscripciones push (FCM)."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class SubscribeRequest(BaseModel):
    fcm_token: str
    alert_levels: list[str] = ["alerta", "precaucion"]
    user_agent: str | None = None


class UnsubscribeRequest(BaseModel):
    fcm_token: str


class UpdateLevelsRequest(BaseModel):
    fcm_token: str
    alert_levels: list[str]


VALID_LEVELS = {"alerta", "precaucion", "normal"}


@router.post("/subscribe")
async def subscribe(request: Request, body: SubscribeRequest):
    """Registra un token FCM para recibir notificaciones."""
    pool = request.app.state.pool

    if not set(body.alert_levels).issubset(VALID_LEVELS):
        raise HTTPException(400, "Niveles inválidos. Use: alerta, precaucion, normal")

    await pool.execute(
        """
        INSERT INTO push_subscriptions (fcm_token, alert_levels, user_agent)
        VALUES ($1, $2, $3)
        ON CONFLICT (fcm_token) DO UPDATE
        SET alert_levels = EXCLUDED.alert_levels,
            user_agent = EXCLUDED.user_agent
        """,
        body.fcm_token,
        body.alert_levels,
        body.user_agent,
    )
    return {"status": "ok", "subscribed": True}


@router.delete("/unsubscribe")
async def unsubscribe(request: Request, body: UnsubscribeRequest):
    """Elimina un token FCM."""
    pool = request.app.state.pool
    result = await pool.execute(
        "DELETE FROM push_subscriptions WHERE fcm_token = $1",
        body.fcm_token,
    )
    return {"status": "ok", "deleted": result.endswith("1")}


@router.put("/levels")
async def update_levels(request: Request, body: UpdateLevelsRequest):
    """Actualiza los niveles de alerta para un suscriptor."""
    pool = request.app.state.pool

    if not set(body.alert_levels).issubset(VALID_LEVELS):
        raise HTTPException(400, "Niveles inválidos. Use: alerta, precaucion, normal")

    result = await pool.execute(
        "UPDATE push_subscriptions SET alert_levels = $1 WHERE fcm_token = $2",
        body.alert_levels,
        body.fcm_token,
    )
    if result.endswith("0"):
        raise HTTPException(404, "Token no encontrado")
    return {"status": "ok", "alert_levels": body.alert_levels}


@router.get("/status")
async def subscription_status(request: Request, fcm_token: str):
    """Consulta el estado de una suscripción."""
    pool = request.app.state.pool
    row = await pool.fetchrow(
        "SELECT alert_levels, created_at FROM push_subscriptions WHERE fcm_token = $1",
        fcm_token,
    )
    if not row:
        return {"subscribed": False}
    return {
        "subscribed": True,
        "alert_levels": row["alert_levels"],
        "created_at": row["created_at"],
    }