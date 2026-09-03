import { Activity, AlertTriangle, Gauge, Mountain, RadioTower } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ALERT_COLORS, ALERT_LABEL, type AlertLevel, type Metrics } from "@/lib/types";

function Tile({
  icon,
  label,
  value,
  sub,
  accent = "teal",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "teal" | "amber" | "red";
}) {
  const color = accent === "red" ? "#ff3b4e" : accent === "amber" ? "#ffb020" : "#2de1c2";
  return (
    <Card className="flex items-center gap-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border"
        style={{ borderColor: `${color}40`, background: `${color}12`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-dim">{label}</div>
        <div className="font-sans text-2xl font-semibold text-text">{value}</div>
        {sub ? <div className="truncate text-[10px] text-faint">{sub}</div> : null}
      </div>
    </Card>
  );
}

export function MetricTiles({ metrics }: { metrics: Metrics | null }) {
  if (!metrics) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="h-[76px] animate-pulse" />
        ))}
      </div>
    );
  }

  const maxAccent =
    (metrics.max_magnitude ?? 0) >= 6 ? "red" : (metrics.max_magnitude ?? 0) >= 4.5 ? "amber" : "teal";

  const alertAccent: "teal" | "amber" | "red" =
    metrics.alert_level === "alerta" ? "red" : metrics.alert_level === "precaucion" ? "amber" : "teal";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Tile
        icon={<Activity className="h-5 w-5" />}
        label="Eventos · 24 h"
        value={String(metrics.events_24h)}
        sub={`ventana ${metrics.window_hours} h`}
      />
      <Tile
        icon={<Gauge className="h-5 w-5" />}
        label="Máxima magnitud"
        value={metrics.max_magnitude != null ? `M ${metrics.max_magnitude.toFixed(1)}` : "—"}
        sub={metrics.max_region ? metrics.max_region.slice(0, 34) : undefined}
        accent={maxAccent}
      />
      <Tile
        icon={<Mountain className="h-5 w-5" />}
        label="Profundidad media"
        value={metrics.avg_depth_km != null ? `${metrics.avg_depth_km} km` : "—"}
        sub="en los últimos 24 h"
      />
      <Tile
        icon={<RadioTower className="h-5 w-5" />}
        label="Estaciones IoT"
        value={`${metrics.stations.online}/${metrics.stations.total}`}
        sub="red de acelerógrafos"
      />
      <Tile
        icon={<AlertTriangle className="h-5 w-5" />}
        label="Nivel de alerta"
        value={ALERT_LABEL[metrics.alert_level]}
        sub="según magnitud máx."
        accent={alertAccent}
      />
    </div>
  );
}