export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export function wsUrl(): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws/live`;
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-MX", { hour12: false });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { hour12: false });
}