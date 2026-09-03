const STEPS = [
  {
    label: "FUENTE",
    title: "SSN · USGS · CIRES",
    desc: "Feeds públicos de sismicidad y alertamiento.",
    color: "#ffb020",
  },
  {
    label: "INGESTA",
    title: "Workers Python",
    desc: "Polling / scraping, normalización de eventos.",
    color: "#2de1c2",
  },
  {
    label: "ALMACENAMIENTO",
    title: "TimescaleDB",
    desc: "Series de tiempo de eventos, métricas y noticias.",
    color: "#ff5cf0",
  },
  {
    label: "API",
    title: "FastAPI",
    desc: "Endpoints REST + WebSocket para este panel.",
    color: "#2de1c2",
  },
  {
    label: "PANEL",
    title: "Dashboard",
    desc: "Consumo en vivo, histórico y alertas.",
    color: "#ffb020",
  },
];

export function ArchDiagram() {
  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.25em] text-dim">
        Arquitectura de datos
      </div>
      <div className="flex flex-col items-stretch gap-0 sm:flex-row sm:items-center">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center">
            <div className="flex-1 rounded-sm border border-line bg-surface-2/50 p-3 text-center">
              <div
                className="text-[9px] uppercase tracking-[0.3em]"
                style={{ color: step.color }}
              >
                {step.label}
              </div>
              <div className="mt-1 font-sans text-sm font-semibold text-text">
                {step.title}
              </div>
              <div className="mt-0.5 text-[10px] text-dim">{step.desc}</div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="hidden px-2 text-lg text-faint sm:block">→</div>
            )}
            {i < STEPS.length - 1 && (
              <div className="block py-1 text-center text-lg text-faint sm:hidden">↓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}