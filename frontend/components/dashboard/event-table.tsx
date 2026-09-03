import { AlertBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtTime, timeAgo } from "@/lib/api";
import { ALERT_COLORS, type SeismicEvent } from "@/lib/types";

const SOURCE_COLOR: Record<string, string> = {
  usgs: "#2de1c2",
  ssn: "#ffb020",
  sim: "#ff5cf0",
};

export function EventTable({ events }: { events: SeismicEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eventos recientes</CardTitle>
        <span className="text-[10px] uppercase tracking-widest text-faint">{events.length} en vista</span>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-faint">
              <th className="pb-2 pr-2 font-normal">Hora UTC</th>
              <th className="pb-2 pr-2 font-normal">Mag</th>
              <th className="pb-2 pr-2 font-normal">Región</th>
              <th className="pb-2 pr-2 font-normal">Prof</th>
              <th className="pb-2 pr-2 font-normal">Fuente</th>
              <th className="pb-2 pr-2 font-normal">Nivel</th>
              <th className="pb-2 font-normal text-right">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-dim">
                  Sin eventos en la ventana
                </td>
              </tr>
            ) : (
              events.map((e) => {
                const magColor =
                  e.magnitude >= 6 ? "#ff3b4e" : e.magnitude >= 4.5 ? "#ffb020" : "#2de1c2";
                return (
                  <tr key={e.id} className="border-t border-line/50 hover:bg-surface-2/40">
                    <td className="py-2 pr-2 text-dim">{fmtTime(e.occurred_at)}</td>
                    <td
                      className="py-2 pr-2 font-mono font-semibold"
                      style={{ color: magColor }}
                    >
                      {e.magnitude.toFixed(1)}
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-2 text-text">
                      {e.region_text}
                    </td>
                    <td className="py-2 pr-2 text-dim">{e.depth_km.toFixed(0)} km</td>
                    <td className="py-2 pr-2">
                      <span
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: SOURCE_COLOR[e.primary_source] ?? "#7b8c99" }}
                      >
                        {e.primary_source}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className="rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-widest"
                        style={{
                          color: ALERT_COLORS[e.alert_level],
                          border: `1px solid ${ALERT_COLORS[e.alert_level]}44`,
                          background: `${ALERT_COLORS[e.alert_level]}12`,
                        }}
                      >
                        {e.alert_level}
                      </span>
                    </td>
                    <td className="py-2 text-right text-faint">{timeAgo(e.occurred_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function LatestEvent({ event }: { event: SeismicEvent | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Último evento</CardTitle>
        <span className="text-[10px] uppercase tracking-widest text-faint">live feed</span>
      </CardHeader>
      {!event ? (
        <div className="py-8 text-center text-xs text-dim">Esperando datos…</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className="font-sans text-5xl font-bold"
              style={{ color: ALERT_COLORS[event.alert_level] }}
            >
              {event.magnitude.toFixed(1)}
            </div>
            <div className="flex flex-col gap-1">
              <AlertBadge level={event.alert_level} />
              <span className="text-[10px] uppercase tracking-widest text-faint">
                {event.primary_source}
              </span>
            </div>
          </div>
          <p className="text-sm leading-snug text-text">{event.region_text}</p>
          <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <div>
              <dt className="text-[9px] uppercase tracking-widest text-faint">Profundidad</dt>
              <dd className="font-mono text-sm text-text">{event.depth_km.toFixed(0)} km</dd>
            </div>
            <div>
              <dt className="text-[9px] uppercase tracking-widest text-faint">Lat</dt>
              <dd className="font-mono text-sm text-text">{event.latitude.toFixed(3)}</dd>
            </div>
            <div>
              <dt className="text-[9px] uppercase tracking-widest text-faint">Lon</dt>
              <dd className="font-mono text-sm text-text">{event.longitude.toFixed(3)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Card>
  );
}