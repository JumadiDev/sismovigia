import { Bell, Radio, Wifi } from "lucide-react";
import { cn } from "@/components/lib";
import { AlertBadge } from "@/components/ui/badge";
import { Clock } from "./clock";
import type { AlertLevel, LiveStatus } from "@/lib/types";

const STATUS_DOT: Record<LiveStatus, { color: string; label: string }> = {
  live: { color: "#2de1c2", label: "EN VIVO" },
  connecting: { color: "#ffb020", label: "CONECTANDO" },
  offline: { color: "#ff3b4e", label: "SIN CONEXIÓN" },
};

export function StatusBar({
  status,
  alertLevel,
  notificationsEnabled = false,
}: {
  status: LiveStatus;
  alertLevel: AlertLevel;
  notificationsEnabled?: boolean;
}) {
  const st = STATUS_DOT[status];
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-teal/40 bg-teal/10">
            <Radio className="h-5 w-5 text-teal" />
          </div>
          <div>
            <h1 className="font-sans text-lg font-bold tracking-[0.25em] text-text">
              SISMOVIGÍA
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
              monitoreo sismológico · méxico
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-sm border border-line px-3 py-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }}
            />
            <span className="text-[10px] uppercase tracking-widest text-dim">{st.label}</span>
            <Wifi className="h-3.5 w-3.5 text-faint" />
          </div>
          <AlertBadge level={alertLevel} />
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-sm border transition-colors",
              notificationsEnabled
                ? "border-teal/40 bg-teal/10 text-teal"
                : "border-line bg-surface text-faint"
            )}
            title={notificationsEnabled ? "Notificaciones activas" : "Notificaciones desactivadas"}
          >
            <Bell className="h-3.5 w-3.5" />
          </div>
          <div className="hidden sm:block">
            <Clock />
          </div>
        </div>
      </div>
    </header>
  );
}

export function StatusPill({ status }: { status: LiveStatus }) {
  const st = STATUS_DOT[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-widest"
      )}
      style={{
        color: st.color,
        borderColor: st.color,
        background: `${st.color}14`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
      {st.label}
    </span>
  );
}