"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export interface NotificationState {
  permission: NotificationPermission;
  token: string | null;
  alertLevels: string[];
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
}

const DEFAULT_LEVELS = ["alerta", "precaucion"];

function getStorageKey() {
  return "sismex_fcm_token";
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(getStorageKey());
}

function storeToken(token: string) {
  localStorage.setItem(getStorageKey(), token);
}

function removeStoredToken() {
  localStorage.removeItem(getStorageKey());
}

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    permission: "default",
    token: null,
    alertLevels: DEFAULT_LEVELS,
    isSubscribed: false,
    loading: false,
    error: null,
  });

  // Verificar permiso y token al montar
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const permission = Notification.permission;
    const storedToken = getStoredToken();

    setState((s) => ({
      ...s,
      permission,
      token: storedToken,
      isSubscribed: !!storedToken,
    }));

    // Verificar suscripción en el backend
    if (storedToken) {
      checkSubscription(storedToken);
    }
  }, []);

  const checkSubscription = async (token: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/notifications/status?fcm_token=${encodeURIComponent(token)}`
      );
      if (res.ok) {
        const data = await res.json();
        setState((s) => ({
          ...s,
          isSubscribed: data.subscribed,
          alertLevels: data.alert_levels || DEFAULT_LEVELS,
        }));
      }
    } catch {
      // Silenciar errores de red
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setState((s) => ({ ...s, error: "Tu navegador no soporta notificaciones" }));
      return false;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      setState((s) => ({ ...s, permission, loading: false }));

      if (permission === "granted") {
        await getFCMToken();
        return true;
      }

      return false;
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Error al solicitar permiso: " + String(err),
      }));
      return false;
    }
  }, []);

  const getFCMToken = useCallback(async () => {
    // En producción, aquí inicializarías Firebase y obtendrías el token real
    // Por ahora, usamos un token provisional para desarrollo
    const token = getStoredToken() || `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    storeToken(token);

    setState((s) => ({
      ...s,
      token,
      isSubscribed: true,
    }));

    // Registrar en el backend
    await subscribeBackend(token, DEFAULT_LEVELS);
  }, []);

  const subscribeBackend = async (token: string, levels: string[]) => {
    try {
      await fetch(`${API_URL}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fcm_token: token,
          alert_levels: levels,
          user_agent: navigator.userAgent,
        }),
      });
    } catch (err) {
      setState((s) => ({ ...s, error: "Error al registrar suscripción" }));
    }
  };

  const unsubscribe = useCallback(async () => {
    const token = state.token;
    if (!token) return;

    setState((s) => ({ ...s, loading: true }));

    try {
      await fetch(`${API_URL}/api/notifications/unsubscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcm_token: token }),
      });

      removeStoredToken();
      setState((s) => ({
        ...s,
        token: null,
        isSubscribed: false,
        loading: false,
        alertLevels: DEFAULT_LEVELS,
      }));
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.token]);

  const updateAlertLevels = useCallback(
    async (levels: string[]) => {
      const token = state.token;
      if (!token) return;

      setState((s) => ({ ...s, alertLevels: levels }));

      try {
        await fetch(`${API_URL}/api/notifications/levels`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fcm_token: token,
            alert_levels: levels,
          }),
        });
      } catch {
        // Revertir en caso de error
        setState((s) => ({ ...s, error: "Error al actualizar niveles" }));
      }
    },
    [state.token]
  );

  return {
    ...state,
    requestPermission,
    unsubscribe,
    updateAlertLevels,
  };
}