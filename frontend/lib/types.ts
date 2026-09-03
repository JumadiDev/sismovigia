export type AlertLevel = "alerta" | "precaucion" | "normal";

export type LiveStatus = "connecting" | "live" | "offline";

export interface SeismicEvent {
  id: string;
  occurred_at: string;
  latitude: number;
  longitude: number;
  depth_km: number;
  magnitude: number;
  region_text: string;
  primary_source: string;
  alert_level: AlertLevel;
}

export interface Metrics {
  window_hours: number;
  events_24h: number;
  max_magnitude: number | null;
  max_region: string | null;
  alert_level: AlertLevel;
  avg_depth_km: number | null;
  stations: { online: number; total: number };
  continuous_5min: {
    bucket: string;
    event_count: number;
    max_magnitude: number;
    avg_depth: number;
  } | null;
}

export interface NewsItem {
  id: number;
  title: string;
  source: string;
  tag: string | null;
  url: string | null;
  body: string | null;
  published_at: string;
}

export interface Snapshot {
  type: "snapshot";
  generated_at: string;
  events: SeismicEvent[];
  news: NewsItem[];
  metrics: {
    events_24h: number;
    max_magnitude: number | null;
    max_region: string | null;
    alert_level: AlertLevel;
    stations: { online: number; total: number };
  };
}

export type LiveMessage = Snapshot | { type: "event:new"; data: SeismicEvent };

export interface TelemetrySample {
  station_id: string;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  temperature: number | null;
  rssi: number | null;
  battery_v: number | null;
  sampled_at: string;
}

export interface Station {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  firmware: string | null;
  status: string;
  last_seen: string;
  samples_24h: number;
}

export const ALERT_COLORS: Record<AlertLevel, string> = {
  alerta: "#ff3b4e",
  precaucion: "#ffb020",
  normal: "#2de1c2",
};

export const ALERT_LABEL: Record<AlertLevel, string> = {
  alerta: "ALERTA",
  precaucion: "PRECAUCIÓN",
  normal: "NORMAL",
};