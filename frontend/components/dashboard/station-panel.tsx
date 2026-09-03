import { Signal, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export function StationPanel({ online, total }: { online: number; total: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Signal className="h-3.5 w-3.5" /> Red IoT · MQTT
        </CardTitle>
        <span className="text-[10px] uppercase tracking-widest text-faint">
          {online}/{total} en línea
        </span>
      </CardHeader>
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#1c2a35" strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="#2de1c2"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - (total ? online / total : 0))}`}
              style={{ transition: "stroke-dashoffset 0.5s" }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="font-sans text-xl font-bold text-text">{online}</div>
            <div className="text-[8px] uppercase tracking-widest text-faint">online</div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-dim">
          Acelerógrafos transmitiendo por{" "}
          <span className="text-teal">sismex/&lt;id&gt;/telemetry</span> a{" "}
          <span className="text-text">100 SPS</span> hacia la hipertabla de telemetría.
        </p>
      </div>
      <div className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[10px] leading-relaxed text-faint">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
        <span>
          Este panel no sustituye el Sistema de Alerta Sísmica Mexicano (SASMEX). Datos con fines de
          monitoreo e investigación.
        </span>
      </div>
    </Card>
  );
}