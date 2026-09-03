import { ExternalLink, Newspaper } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/api";
import type { NewsItem } from "@/lib/types";

export function NewsFeed({ news }: { news: NewsItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5" /> Boletines
        </CardTitle>
        <span className="text-[10px] uppercase tracking-widest text-faint">
          {news.length} ítems
        </span>
      </CardHeader>
      <div className="flex flex-col gap-3">
        {news.length === 0 ? (
          <p className="py-6 text-center text-xs text-dim">Sin boletines todavía</p>
        ) : (
          news.map((n) => (
            <article key={n.id} className="group rounded-sm border border-line p-3 transition-colors hover:border-line-strong">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-full border border-teal/40 px-2 py-0.5 text-[9px] uppercase tracking-widest text-teal">
                  {n.tag ?? n.source}
                </span>
                <span className="text-[10px] text-faint">{timeAgo(n.published_at)}</span>
              </div>
              <h3 className="font-sans text-sm font-semibold leading-snug text-text">
                {n.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-dim">{n.body}</p>
              {n.url ? (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-teal hover:underline"
                >
                  Reporte oficial <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </article>
          ))
        )}
      </div>
    </Card>
  );
}