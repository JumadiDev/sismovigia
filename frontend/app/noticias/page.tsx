"use client";

import { useCallback, useEffect, useState } from "react";
import { Newspaper, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getJson, timeAgo } from "@/lib/api";
import { cn } from "@/components/lib";
import type { NewsItem } from "@/lib/types";

const FILTERS = [
  { id: "todos", label: "TODAS" },
  { id: "SASMEX", label: "ALERTAS" },
  { id: "SSN", label: "SISMOS" },
  { id: "CENAPRED", label: "PROTECCIÓN CIVIL" },
  { id: "SISMEX", label: "LAB" },
] as const;

export default function NoticiasView() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<string>("todos");

  const load = useCallback(async () => {
    try {
      setNews(await getJson<NewsItem[]>("/api/news?limit=50"));
    } catch {
      /* sin datos */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const visible = filter === "todos" ? news : news.filter((n) => (n.tag ?? n.source) === filter);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-teal/40 bg-teal/10">
          <Newspaper className="h-5 w-5 text-teal" />
        </div>
        <div>
          <h1 className="font-sans text-lg font-bold tracking-[0.2em] text-text">NOTICIAS</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-dim">boletines oficiales y del panel</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest transition-colors",
              filter === f.id
                ? "border-teal bg-teal/10 text-teal"
                : "border-line text-dim hover:border-line-strong hover:text-text"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <p className="py-8 text-center text-xs text-dim">Sin boletines en esta categoría.</p>
          </Card>
        ) : (
          visible.map((n) => (
            <article key={n.id} className="rounded-sm border border-line p-4 transition-colors hover:border-line-strong">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full border border-teal/40 px-2 py-0.5 text-[9px] uppercase tracking-widest text-teal">
                  {n.tag ?? n.source}
                </span>
                <span className="text-[10px] text-faint">{timeAgo(n.published_at)}</span>
              </div>
              <h2 className="font-sans text-sm font-semibold leading-snug text-text">{n.title}</h2>
              <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-dim">{n.body}</p>
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-widest">
                <span className="text-faint">{n.source}</span>
                {n.url ? (
                  <a href={n.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal hover:underline">
                    Reporte <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fuente</CardTitle>
        </CardHeader>
        <p className="text-[11px] leading-relaxed text-dim">
          Los boletines provienen de la página pública de CIRES/SASMEX. Los ítems simulados del
          mockup quedaron marcados como <span className="text-amber">ejemplo ·</span>; este panel
          solo muestra boletines reales indexados por el backend.
        </p>
      </Card>
    </div>
  );
}