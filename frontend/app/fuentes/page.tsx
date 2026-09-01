"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Server } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getJson, timeAgo } from "@/lib/api";

interface WorkerState {
  status: "ok" | "stale" | "error" | "never_run";
  last_started_at?: string;
  events_found?: number;
  error?: string | null;
}

const SOURCES = [
  {
    key: "usgs",
    name: "USGS · NEIC",
    desc: "Fuente primaria de eventos. API FDSN/GeoJSON, bbox México, minmag 2.5, poll cada 60 s.",
    priority: "primaria",
    color: "#2de1c2",
  },
  {
    key: "ssn",
    name: "SSN · UNAM",
    desc: "Fuente secundaria. Scraping respetuoso de la tabla pública de últimos sismos (cada 5 min), parseo defensivo.",
    priority: "secundaria",
    color: "#ffb020",
  },
  {
    key: "sasmex",
    name: "CIRES · SASMEX",
    desc: "Boletín informativo (no eventos geolocalizados). Se guarda en news_items. Poll cada 10 min.",
    priority: "boletín",
    color: "#ff5cf0",
  },
  {
    key: "cenapred",
    name: "CENAPRED",
    desc: "Sin feed en tiempo real en v1; su valor está en reportes y atlas de riesgos (fase 2).",
    priority: "pendiente",
    color: "#7b8c99",
  },
];

const STATUS_LABEL: Record<string, string> = {
  ok: "operativo",
  stale: "sin actividad reciente",
  error: "error",
  never_run: "sin corridas",
};

export default function FuentesView() {
  const [health, setHealth] = useState<Record<string, WorkerState> | null>(null);

  const load = useCallback(async () => {
    try {
      const h = await getJson<{ workers: Record<string, WorkerState> }>("/api/health");
      setHealth(h.workers);
    } catch {
      /* sin API */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const statusColor = (s: string) =>
    s === "ok" ? "#2de1c2" : s === "error" ? "#ff3b4e" : s === "stale" ? "#ffb020" : "#46545f";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-teal/40 bg-teal/10">
          <Database className="h-5 w-5 text-teal" />
        </div>
        <div>
          <h1 className="font-sans text-lg font-bold tracking-[0.2em] text-text">FUENTES OFICIALES</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-dim">ingesta · deduplicación · estado</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SOURCES.map((s) => {
          const st = health?.[s.key];
          const color = st ? statusColor(st.status) : "#46545f";
          return (
            <Card key={s.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5" style={{ color }} />
                  {s.name}
                </CardTitle>
                <span
                  className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest"
                  style={{ color, borderColor: `${color}55`, background: `${color}12` }}
                >
                  {st ? STATUS_LABEL[st.status] : "sin reporte"}
                </span>
              </CardHeader>
              <p className="text-[11px] leading-relaxed text-dim">{s.desc}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[10px]">
                <div>
                  <dt className="uppercase tracking-widest text-faint">Rol</dt>
                  <dd className="text-text">{s.priority}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-faint">Última corrida</dt>
                  <dd className="text-text">
                    {st?.last_started_at ? timeAgo(st.last_started_at) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-faint">Eventos encontrados</dt>
                  <dd className="text-text">{st?.events_found ?? "—"}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-widest text-faint">Estado</dt>
                  <dd className="text-text">{st ? st.status : "never_run"}</dd>
                </div>
              </dl>
              {st?.error ? (
                <p className="mt-2 rounded-sm border border-red/30 bg-red/10 px-2 py-1 text-[10px] text-red">
                  {st.error}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nota ética</CardTitle>
        </CardHeader>
        <p className="text-[11px] leading-relaxed text-dim">
          El panel integra datos de fuentes oficiales pero <span className="text-amber">no sustituye</span> al
          Sistema de Alerta Sísmica Mexicano (SASMEX) ni a la protección civil. La deduplicación
          (USGS &gt; SSN) evita eventos duplicados; cada evento muestra su fuente primaria.
        </p>
      </Card>
    </div>
  );
}