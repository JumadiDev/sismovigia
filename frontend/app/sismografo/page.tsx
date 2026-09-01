"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getJson } from "@/lib/api";
import type { Station, TelemetrySample } from "@/lib/types";

const AXES = [
  { key: "accel_x", color: "#2de1c2", label: "X" },
  { key: "accel_y", color: "#ff5cf0", label: "Y" },
  { key: "accel_z", color: "#ffb020", label: "Z" },
] as const;

function Wave({ samples, axis }: { samples: TelemetrySample[]; axis: (typeof AXES)[number] }) {
  const W = 900;
  const H = 110;
  const values = samples.map((s) => s[axis.key]);
  if (values.length < 2) {
    return (
      <div style={{ height: H }} className="flex items-center justify-center text-[10px] text-faint">
        esperando muestras…
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = W / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(H - 6 - ((v - min) / span) * (H - 12)).toFixed(1)}`)
    .join(" ");
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[9px] uppercase tracking-widest">
        <span style={{ color: axis.color }}>●</span>
        <span className="text-dim">eje {axis.label}</span>
        <span className="ml-auto text-faint">
          rango {min.toFixed(3)} … {max.toFixed(3)} g
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[110px] w-full">
        <polyline
          points={pts}
          fill="none"
          stroke={axis.color}
          strokeWidth="1.2"
          style={{ filter: `drop-shadow(0 0 4px ${axis.color}66)` }}
        />
      </svg>
    </div>
  );
}

export default function SismografoView() {
  const [stations, setStations] = useState<Station[]>([]);
  const [station, setStation] = useState("SX-002");
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [meta, setMeta] = useState<Station | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await getJson<Station[]>("/api/stations");
      setStations(list);
    } catch {
      /* sin API */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    const fetchSamples = async () => {
      try {
        const s = await getJson<TelemetrySample[]>(`/api/telemetry/recent?station=${station}&limit=400`);
        if (alive) setSamples(s);
        const st = stations.find((x) => x.id === station) ?? null;
        if (alive) setMeta(st);
      } catch {
        /* sin datos aún */
      }
    };
    fetchSamples();
    timer.current = setInterval(fetchSamples, 2000);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [station, stations]);

  const latest = samples[samples.length - 1];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-teal/40 bg-teal/10">
            <Activity className="h-5 w-5 text-teal" />
          </div>
          <div>
            <h1 className="font-sans text-lg font-bold tracking-[0.2em] text-text">SISMÓGRAFO</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-dim">telemetría en vivo · red IoT</p>
          </div>
        </div>
        <select
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="h-9 rounded-sm border border-line bg-surface px-3 font-mono text-xs text-text outline-none focus:border-teal"
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                {meta ? `${meta.id} · ${meta.name}` : station} — aceleración
              </CardTitle>
              <Badge status={meta?.status === "online" ? "on" : meta?.status === "degraded" ? "deg" : "off"}>
                {meta?.status ?? "…"}
              </Badge>
            </CardHeader>
            <div className="flex flex-col gap-4">
              {AXES.map((a) => (
                <Wave key={a.key} samples={samples} axis={a} />
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Muestra actual</CardTitle>
              <span className="text-[10px] text-faint">{samples.length} puntos</span>
            </CardHeader>
            {latest ? (
              <dl className="grid grid-cols-2 gap-2 text-center">
                {(
                  [
                    ["accel_x", "X (g)"],
                    ["accel_y", "Y (g)"],
                    ["accel_z", "Z (g)"],
                    ["temperature", "Temp °C"],
                    ["rssi", "RSSI dBm"],
                    ["battery_v", "Batería V"],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="rounded-sm border border-line bg-surface-2/50 p-2">
                    <dt className="text-[9px] uppercase tracking-widest text-faint">{label}</dt>
                    <dd className="font-mono text-sm text-text">
                      {latest[k] != null ? Number(latest[k]).toFixed(2) : "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="py-6 text-center text-xs text-dim">Sin telemetría recibida.</p>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Muestras · 24 h</CardTitle>
            </CardHeader>
            <p className="font-sans text-3xl font-bold text-teal">{meta?.samples_24h ?? 0}</p>
            <p className="mt-1 text-[10px] text-faint">
              {meta?.location ?? ""} · firmware {meta?.firmware ?? "—"}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}