"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getJson, timeAgo } from "@/lib/api";
import type { Station } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  online: "#2de1c2",
  degraded: "#ffb020",
  offline: "#ff3b4e",
};

export default function RedIoTView() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStations(await getJson<Station[]>("/api/stations"));
      setLoadError(null);
    } catch (e) {
      setLoadError(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const total = stations.length;
  const online = stations.filter((s) => s.status === "online").length;
  const samples = stations.reduce((a, s) => a + s.samples_24h, 0);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-teal/40 bg-teal/10">
            <Radio className="h-5 w-5 text-teal" />
          </div>
          <div>
            <h1 className="font-sans text-lg font-bold tracking-[0.2em] text-text">RED IoT</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-dim">
              acelerógrafos · broker mosquitto:1883
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-faint">
          <span className="rounded-sm border border-line px-2 py-1">
            {online}/{total} en línea
          </span>
          <span className="rounded-sm border border-line px-2 py-1">{samples.toLocaleString()} muestras/24h</span>
        </div>
      </div>

      {loadError && (
        <div className="rounded-sm border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">
          {loadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Estaciones</CardTitle>
          <span className="text-[10px] text-faint">actualiza cada 10 s</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-faint">
                <th className="pb-2 pr-2 font-normal">ID</th>
                <th className="pb-2 pr-2 font-normal">Nombre</th>
                <th className="pb-2 pr-2 font-normal">Ubicación</th>
                <th className="pb-2 pr-2 font-normal">Coord</th>
                <th className="pb-2 pr-2 font-normal">Firmware</th>
                <th className="pb-2 pr-2 font-normal">Estado</th>
                <th className="pb-2 pr-2 font-normal">Muestras 24h</th>
                <th className="pb-2 font-normal text-right">Última señal</th>
              </tr>
            </thead>
            <tbody>
              {stations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-dim">
                    Sin estaciones
                  </td>
                </tr>
              ) : (
                stations.map((s) => (
                  <tr key={s.id} className="border-t border-line/50 hover:bg-surface-2/40">
                    <td className="py-2 pr-2 font-mono font-semibold text-teal">{s.id}</td>
                    <td className="py-2 pr-2 text-text">{s.name}</td>
                    <td className="py-2 pr-2 text-dim">{s.location ?? "—"}</td>
                    <td className="py-2 pr-2 text-faint">
                      {s.latitude != null ? `${s.latitude.toFixed(2)}, ${s.longitude?.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2 pr-2 text-dim">{s.firmware ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest"
                        style={{
                          color: STATUS_COLOR[s.status],
                          borderColor: `${STATUS_COLOR[s.status]}44`,
                          background: `${STATUS_COLOR[s.status]}12`,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[s.status] }} />
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-2 font-mono text-text">{s.samples_24h.toLocaleString()}</td>
                    <td className="py-2 text-right text-faint">{timeAgo(s.last_seen)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tópicos MQTT</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {["sismex/+/telemetry", "sismex/+/status", "sismex/+/alarm"].map((t) => (
            <code key={t} className="rounded-sm border border-line bg-surface-2/50 px-2 py-1 text-[11px] text-teal">
              {t}
            </code>
          ))}
        </div>
      </Card>
    </div>
  );
}