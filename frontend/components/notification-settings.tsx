"use client";

import { useState } from "react";
import { Bell, BellOff, ChevronDown, ChevronUp } from "lucide-react";
import { useNotifications } from "@/lib/use-notifications";

const ALERT_LEVELS = [
  { value: "alerta", label: "ALERTA", description: "M ≥ 6.0 — Sismos peligrosos", color: "#ff3b4e" },
  { value: "precaucion", label: "PRECAUCIÓN", description: "M 4.5–5.9 — Sismos significativos", color: "#ffb020" },
  { value: "normal", label: "NORMAL", description: "M < 4.5 — Todos los sismos", color: "#2de1c2" },
];

export function NotificationSettings() {
  const {
    permission,
    isSubscribed,
    alertLevels,
    loading,
    error,
    requestPermission,
    unsubscribe,
    updateAlertLevels,
  } = useNotifications();

  const [expanded, setExpanded] = useState(false);

  const handleToggleLevel = async (level: string) => {
    const newLevels = alertLevels.includes(level)
      ? alertLevels.filter((l) => l !== level)
      : [...alertLevels, level];

    if (newLevels.length === 0) {
      return;
    }

    await updateAlertLevels(newLevels);
  };

  const handleEnable = async () => {
    await requestPermission();
  };

  return (
    <div className="rounded-sm border border-line bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          {isSubscribed && permission === "granted" ? (
            <Bell className="h-4 w-4 text-teal" />
          ) : (
            <BellOff className="h-4 w-4 text-faint" />
          )}
          <div>
            <span className="text-xs uppercase tracking-widest text-dim">
              Alertas Push
            </span>
            <span className="ml-2 text-[10px] uppercase tracking-widest">
              {isSubscribed && permission === "granted" ? (
                <span className="text-teal">ACTIVO</span>
              ) : (
                <span className="text-faint">INACTIVO</span>
              )}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-faint" />
        ) : (
          <ChevronDown className="h-4 w-4 text-faint" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-line px-4 py-3">
          {error && (
            <div className="mb-3 rounded-sm border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">
              {error}
            </div>
          )}

          {!isSubscribed || permission !== "granted" ? (
            <div className="space-y-3">
              <p className="text-xs text-dim">
                Recibe notificaciones en tu dispositivo cuando haya sismos importantes.
              </p>
              <button
                onClick={handleEnable}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-sm border border-teal/40 bg-teal/10 px-4 py-2 text-xs uppercase tracking-widest text-teal transition-colors hover:bg-teal/20 disabled:opacity-50"
              >
                <Bell className="h-3.5 w-3.5" />
                {loading ? "Activando..." : "Activar Notificaciones"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-dim">
                Selecciona qué niveles de alerta quieres recibir:
              </p>

              <div className="space-y-2">
                {ALERT_LEVELS.map((level) => (
                  <label
                    key={level.value}
                    className="flex cursor-pointer items-center gap-3 rounded-sm border border-line px-3 py-2 transition-colors hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={alertLevels.includes(level.value)}
                      onChange={() => handleToggleLevel(level.value)}
                      className="h-3.5 w-3.5 accent-current"
                      style={{ accentColor: level.color }}
                    />
                    <div className="flex-1">
                      <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: level.color }}
                      >
                        {level.label}
                      </span>
                      <span className="ml-2 text-[10px] text-dim">
                        {level.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <button
                onClick={unsubscribe}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-sm border border-red/30 px-4 py-2 text-xs uppercase tracking-widest text-red transition-colors hover:bg-red/10 disabled:opacity-50"
              >
                <BellOff className="h-3.5 w-3.5" />
                Desactivar Notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}