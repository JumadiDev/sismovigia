"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Database, LayoutGrid, Map, Newspaper, Radio } from "lucide-react";
import { cn } from "@/components/lib";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/sismografo", label: "Sismógrafo", icon: Activity },
  { href: "/mapa", label: "Mapa sísmico", icon: Map },
  { href: "/noticias", label: "Noticias", icon: Newspaper },
  { href: "/fuentes", label: "Fuentes oficiales", icon: Database },
  { href: "/red-iot", label: "Red IoT", icon: Radio },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface/40 py-4 md:w-52 md:items-stretch md:px-3">
      <div className="mb-4 hidden flex-col items-center gap-1 md:flex">
        <span className="font-sans text-sm font-bold tracking-[0.2em] text-teal">SISMOVIGÍA</span>
        <span className="text-[9px] uppercase tracking-[0.3em] text-faint">monitoreo sísmico</span>
      </div>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex items-center gap-3 rounded-sm px-2 py-2.5 text-xs transition-colors",
              active
                ? "bg-teal/10 text-teal"
                : "text-dim hover:bg-surface-2/60 hover:text-text"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-teal" />
            )}
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden uppercase tracking-widest md:inline">{label}</span>
          </Link>
        );
      })}
      <div className="mt-auto hidden border-t border-line pt-3 text-[9px] leading-relaxed text-faint md:block">
        Panel de monitoreo con fines educativos. No sustituye a SASMEX.
      </div>
    </aside>
  );
}