"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, Pause, Play, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getJson } from "@/lib/api";
import { useTelemetry } from "@/lib/use-telemetry";
import type { Station, TelemetrySample } from "@/lib/types";

const AXES = [
  { key: "accel_x", color: "#2de1c2", label: "X", range: 0.5 },
  { key: "accel_y", color: "#ff5cf0", label: "Y", range: 0.5 },
  { key: "accel_z", color: "#ffb020", label: "Z", range: 1.5 },
] as const;

type Axis = (typeof AXES)[number];

const STATION_KEY = "sismovigia:sismografo:station";

function WaveSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-1 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-line" />
        <div className="h-2 w-8 bg-line" />
      </div>
      <div className="h-[110px] w-full rounded-sm bg-line/50" />
    </div>
  );
}

function Wave({ samples, axis }: { samples: TelemetrySample[]; axis: Axis }) {
  const W = 900;
  const H = 110;
  const pad = 10;
  const values = samples.map((s) => s[axis.key] ?? 0);
  if (values.length < 2) {
    return (
      <div style={{ height: H }} className="flex items-center justify-center text-[10px] text-faint">
        esperando muestras…
      </div>
    );
  }
  const [minV, maxV] = [-axis.range, axis.range];
  const span = maxV - minV;
  const y = (v: number) => (H - pad - ((v - minV) / span) * (H - pad * 2)).toFixed(1);
  const step = W / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${y(v)}`).join(" ");
  const yZero = y(0);
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[9px] uppercase tracking-widest">
        <span style={{ color: axis.color }}>●</span>
        <span className="text-dim">eje {axis.label}</span>
        <span className="ml-auto text-faint">
          escala ±{axis.range} g
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[110px] w-full">
        <line x1="0" y1={yZero} x2={W} y2={yZero} stroke="#ffffff14" strokeDasharray="4 4" />
        <line x1="0" y1={y(maxV)} x2={W} y2={y(maxV)} stroke="#ffffff0d" />
        <line x1="0" y1={y(minV)} x2={W} y2={y(minV)} stroke="#ffffff0d" />
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
  const [station, setStation] = useState<string>(() => {
    if (typeof window === "undefined") return "SX-002";
    return localStorage.getItem(STATION_KEY) ?? "SX-002";
  });
  const [paused, setPaused] = useState(false);
  const [meta, setMeta] = useState<Station | null>(null);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const { status, samples, error: telemetryError } = useTelemetry(station, !paused);

  useEffect(() => {
    localStorage.setItem(STATION_KEY, station);
  }, [station]);

  const loadStations = useCallback(async () => {
    try {
      const list = await getJson<Station[]>("/api/stations");
      setStations(list);
      setStationsError(null);
    } catch {
      setStationsError("No se pudieron cargar las estaciones");
    }
  }, []);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  useEffect(() => {
    const st = stations.find((x) => x.id === station) ?? null;
    setMeta(st);
  }, [station, stations]);

  const latest = samples[samples.length - 1];
  const isConnected = status === "live" && !paused;
  const isLoading = status === "connecting" && !paused;

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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px]">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-teal" />
            ) : (
              <WifiOff className="h-3 w-3 text-red" />
            )}
            <span className={isConnected ? "text-teal" : "text-red"}>
              {paused ? "pausado" : isConnected ? "en vivo" : "desconectado"}
            </span>
          </div>
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-xs text-dim outline-none focus:border-teal"
            title={paused ? "Reanudar telemetría" : "Pausar telemetría"}
          >
            {paused ? <Play className="h-3.5 w-3.5 text-teal" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? "reanudar" : "pausa"}
          </button>
          <Badge status={meta?.status === "online" ? "on" : meta?.status === "degraded" ? "deg" : "off"}>
            {meta?.status ?? "offline"}
          </Badge>
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
      </div>

      {(stationsError || telemetryError) && (
        <div className="flex items-center gap-2 rounded-sm border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">
          <AlertCircle className="h-4 w-4" />
          <span>{stationsError || telemetryError}</span>
          <button onClick={loadStations} className="ml-auto text-red hover:text-red/80">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                {meta ? `${meta.id} · ${meta.name}` : station} — aceleración
              </CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-4">
              {isLoading ? (
                AXES.map((a) => <WaveSkeleton key={a.key} />)
              ) : (
                AXES.map((a) => <Wave key={a.key} samples={samples} axis={a} />)
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Muestra actual</CardTitle>
              <span className="text-[10px] text-faint">{samples.length} puntos</span>
            </CardHeader>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-sm bg-line/50" />
                ))}
              </div>
            ) : latest ? (
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
            {isLoading ? (
              <div className="h-10 w-24 animate-pulse rounded bg-line/50" />
            ) : (
              <>
                <p className="font-sans text-3xl font-bold text-teal">{meta?.samples_24h ?? 0}</p>
                <p className="mt-1 text-[10px] text-faint">
                  {meta?.location ?? ""} · firmware {meta?.firmware ?? "—"}
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}