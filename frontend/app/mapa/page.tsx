"use client";

import { useCallback, useEffect, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getJson } from "@/lib/api";
import { ALERT_COLORS, type SeismicEvent, type Station } from "@/lib/types";

// Bbox aproximado de México (SPEC: vista abstracta 500×340)
const W = 500;
const H = 340;
const LON_MIN = -119;
const LON_MAX = -86;
const LAT_MIN = 14;
const LAT_MAX = 33;

function toXY(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
  return { x, y };
}

function magColor(mag: number): string {
  return mag >= 6 ? ALERT_COLORS.alerta : mag >= 4.5 ? ALERT_COLORS.precaucion : ALERT_COLORS.normal;
}

export default function MapaView() {
  const [events, setEvents] = useState<SeismicEvent[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [evs, sts] = await Promise.all([
        getJson<SeismicEvent[]>("/api/events/recent?hours=168&limit=300"),
        getJson<Station[]>("/api/stations"),
      ]);
      setEvents(evs);
      setStations(sts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-teal/40 bg-teal/10">
          <MapIcon className="h-5 w-5 text-teal" />
        </div>
        <div>
          <h1 className="font-sans text-lg font-bold tracking-[0.2em] text-text">MAPA SÍSMICO</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-dim">
            {events.length} eventos · últimos 7 días
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proyección abstracta · México</CardTitle>
          <span className="flex items-center gap-3 text-[9px] uppercase tracking-widest text-faint">
            <span style={{ color: ALERT_COLORS.normal }}>● &lt;4.5</span>
            <span style={{ color: ALERT_COLORS.precaucion }}>● 4.5–5.9</span>
            <span style={{ color: ALERT_COLORS.alerta }}>● ≥6</span>
            <span className="text-dim">◇ estación IoT</span>
          </span>
        </CardHeader>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-line bg-surface-2/30">
          <defs>
            <pattern id="mapgrid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#1c2a35" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#mapgrid)" />
          {/* outline realista de México (GeoJSON glynnbird/countriesgeojson) */}
          <path
            d="M331.2,127.6 L325.3,143.3 L322.7,156.2 L321.6,180.2 L320.1,188.9 L322.7,198.7 L327.4,207.4 L330.5,221.3 L340.5,234.6 L344.1,244.8 L350.0,253.6 L366.1,258.4 L372.3,265.8 L385.6,260.8 L397.2,259.0 L408.5,255.8 L418.1,252.7 L427.7,245.4 L431.3,235.0 L432.6,220.0 L435.2,214.7 L445.4,210.1 L461.5,205.9 L474.9,206.5 L484.1,205.0 L487.7,208.8 L487.2,217.4 L479.0,228.1 L475.4,239.0 L478.2,242.1 L476.0,249.8 L472.2,263.8 L468.3,259.2 L465.2,259.5 L462.3,259.7 L456.8,270.5 L454.1,268.4 L452.3,269.2 L452.4,271.9 L438.4,271.7 L424.2,271.7 L424.2,281.8 L417.4,281.8 L423.0,287.8 L428.6,291.9 L430.3,295.8 L432.7,296.9 L432.4,303.0 L412.9,303.0 L405.6,317.6 L407.8,320.9 L406.0,325.1 L405.6,330.4 L388.5,311.1 L380.7,305.3 L368.3,300.6 L359.8,301.9 L347.7,308.6 L340.0,310.4 L329.3,305.7 L318.0,302.3 L303.8,294.1 L292.5,291.6 L275.3,283.3 L262.6,274.7 L258.8,269.9 L250.3,268.9 L234.8,263.2 L228.5,255.0 L212.2,244.9 L204.7,233.6 L201.0,224.9 L206.1,223.1 L204.5,218.0 L208.0,213.4 L208.1,207.2 L203.0,199.1 L201.6,192.0 L196.5,183.0 L183.2,165.2 L167.9,151.2 L160.6,140.1 L147.6,132.8 L144.8,128.4 L147.1,117.3 L139.4,113.2 L130.4,104.5 L126.7,92.0 L118.5,90.5 L109.7,81.1 L102.6,72.4 L101.9,66.8 L93.8,53.3 L88.4,39.6 L88.7,32.7 L77.7,25.6 L72.6,26.4 L64.0,21.5 L61.6,28.7 L64.1,37.3 L65.5,50.8 L70.7,58.2 L82.0,70.5 L84.5,74.7 L86.8,76.0 L88.8,82.1 L91.5,81.9 L94.5,93.4 L99.1,98.0 L102.3,104.3 L111.9,113.4 L116.9,130.0 L121.4,137.9 L125.6,146.3 L126.4,155.7 L133.7,156.3 L139.8,164.4 L145.3,172.4 L144.9,175.6 L138.6,182.2 L135.9,182.1 L131.9,171.2 L122.0,161.0 L111.1,152.4 L103.3,147.8 L103.8,134.7 L101.5,125.0 L94.3,119.5 L83.9,111.5 L81.9,113.8 L78.0,109.2 L68.7,104.8 L59.8,94.4 L60.9,93.1 L67.1,94.1 L72.7,87.4 L73.3,79.3 L61.6,66.6 L52.7,61.6 L47.2,50.4 L41.5,38.7 L34.5,24.4 L28.4,8.3 L45.6,6.9 L64.8,5.0 L63.4,8.5 L86.3,17.2 L120.9,29.8 L151.0,29.7 L163.0,29.7 L163.0,22.3 L189.3,22.3 L194.8,28.6 L202.6,34.3 L211.6,42.2 L216.6,51.5 L220.3,61.3 L228.2,66.7 L240.8,72.1 L250.3,58.0 L262.7,57.6 L273.4,64.8 L281.0,77.0 L286.2,87.5 L295.2,97.7 L298.5,110.2 L302.7,118.6 L314.5,124.2 L325.3,128.1 L331.2,127.6 Z"
            fill="#0a0f14"
            stroke="#2c4050"
            strokeWidth="1"
          />
          {loading ? (
            <text x={W / 2} y={H / 2} textAnchor="middle" fill="#46545f" fontSize="12">
              cargando…
            </text>
          ) : (
            <>
              {stations.map((s) =>
                s.latitude != null && s.longitude != null ? (
                  <g key={s.id} transform={`translate(${toXY(s.latitude, s.longitude).x} ${toXY(s.latitude, s.longitude).y})`}>
                    <path d="M0,-5 L4,3 L0,0 L-4,3 Z" fill="none" stroke="#7b8c99" strokeWidth="0.8" />
                    <title>{`${s.id} · ${s.name}`}</title>
                  </g>
                ) : null
              )}
              {events.map((e) => {
                const { x, y } = toXY(e.latitude, e.longitude);
                const r = Math.max(2.5, Math.min(12, 2 + e.magnitude * 1.2));
                return (
                  <g key={e.id}>
                    <circle cx={x} cy={y} r={r} fill={magColor(e.magnitude)} fillOpacity="0.35" />
                    <circle cx={x} cy={y} r={Math.max(1.5, r * 0.45)} fill={magColor(e.magnitude)}>
                      <title>{`M${e.magnitude.toFixed(1)} · ${e.region_text}`}</title>
                    </circle>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {events.slice(0, 6).map((e) => (
          <div key={e.id} className="rounded-sm border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xl font-bold" style={{ color: magColor(e.magnitude) }}>
                M{e.magnitude.toFixed(1)}
              </span>
              <span className="text-[10px] text-faint">{new Date(e.occurred_at).toLocaleString("es-MX", { hour12: false })}</span>
            </div>
            <p className="mt-1 truncate text-xs text-text">{e.region_text}</p>
            <p className="text-[10px] text-dim">
              {e.latitude.toFixed(3)}, {e.longitude.toFixed(3)} · {e.depth_km.toFixed(0)} km · {e.primary_source}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}