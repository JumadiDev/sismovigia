# -*- coding: utf-8 -*-
"""Servicio de notificaciones push vía Firebase Cloud Messaging."""
import logging
import os

import firebase_admin
from firebase_admin import credentials, messaging

log = logging.getLogger("sismovigia.notifications")

_initialized = False


def init_firebase():
    """Inicializa Firebase Admin SDK (una sola vez)."""
    global _initialized
    if _initialized:
        return

    cred_path = os.environ.get("FIREBASE_CREDENTIALS")
    if not cred_path:
        log.warning("FIREBASE_CREDENTIALS no definido — push deshabilitado")
        return

    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _initialized = True
        log.info("Firebase Admin SDK inicializado")
    except Exception as exc:
        log.error("Error inicializando Firebase: %s", exc)


def is_initialized() -> bool:
    return _initialized


async def send_push(
    pool,
    title: str,
    body: str,
    data: dict | None = None,
    alert_level: str | None = None,
) -> int:
    """Envía notificación push a todos los suscriptores del nivel dado.

    Devuelve el número de notificaciones enviadas con éxito.
    """
    if not _initialized:
        return 0

    query = "SELECT fcm_token FROM push_subscriptions"
    params: list = []
    if alert_level:
        query += " WHERE $1 = ANY(alert_levels)"
        params.append(alert_level)

    rows = await pool.fetch(query, *params)
    if not rows:
        return 0

    tokens = [r["fcm_token"] for r in rows]

    sent = 0
    for i in range(0, len(tokens), 500):
        batch = tokens[i : i + 500]
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=batch,
        )
        try:
            response = messaging.send_each(message)
            sent += response.success_count
            if response.failure_count > 0:
                log.warning("FCM: %d fallos de envío", response.failure_count)
        except Exception as exc:
            log.error("Error enviando push: %s", exc)

    return sent