"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJson, wsUrl } from "@/lib/api";
import type { LiveMessage, LiveStatus, Metrics, NewsItem, SeismicEvent, Snapshot } from "@/lib/types";

export interface LiveState {
  status: LiveStatus;
  lastEvent: SeismicEvent | null;
  events: SeismicEvent[];
  news: NewsItem[];
  metrics: Metrics | null;
  error: string | null;
}

function applySnapshot(state: LiveState, snap: Snapshot): LiveState {
  return {
    ...state,
    status: "live",
    events: snap.events,
    news: snap.news,
    metrics: snap.metrics
      ? {
          window_hours: 24,
          events_24h: snap.metrics.events_24h,
          max_magnitude: snap.metrics.max_magnitude,
          max_region: snap.metrics.max_region,
          alert_level: snap.metrics.alert_level,
          avg_depth_km: null,
          stations: snap.metrics.stations,
          continuous_5min: null,
        }
      : null,
  };
}

function applyNewEvent(state: LiveState, ev: SeismicEvent): LiveState {
  const events = [ev, ...state.events.filter((e) => e.id !== ev.id)].slice(0, 50);
  const maxMag = events.reduce<number | null>(
    (m, e) => (m === null || e.magnitude > m ? e.magnitude : m),
    null
  );
  return {
    ...state,
    lastEvent: ev,
    events,
    metrics: state.metrics
      ? {
          ...state.metrics,
          events_24h: state.metrics.events_24h + 1,
          max_magnitude: maxMag,
          max_region: maxMag === ev.magnitude ? ev.region_text : state.metrics.max_region,
          alert_level: maxMag !== null && maxMag >= 6 ? "alerta" : maxMag !== null && maxMag >= 4.5 ? "precaucion" : "normal",
        }
      : state.metrics,
  };
}

export function useLive(): LiveState {
  const [state, setState] = useState<LiveState>({
    status: "connecting",
    lastEvent: null,
    events: [],
    news: [],
    metrics: null,
    error: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);

  // Carga inicial REST (fallback si WS falla)
  useEffect(() => {
    let alive = true;
    Promise.all([
      getJson<Metrics>("/api/metrics/live"),
      getJson<SeismicEvent[]>("/api/events/recent?hours=24&limit=20"),
      getJson<NewsItem[]>("/api/news?limit=10"),
    ])
      .then(([metrics, events, news]) => {
        if (!alive) return;
        setState((s) => ({ ...s, status: "connecting", metrics, events, news }));
      })
      .catch((err) => alive && setState((s) => ({ ...s, error: String(err) })));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setState((s) => ({ ...s, status: "live", error: null }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as LiveMessage;
          if (msg.type === "snapshot") {
            setState((s) => applySnapshot(s, msg));
          } else if (msg.type === "event:new") {
            setState((s) => applyNewEvent(s, msg.data));
          }
        } catch {
          /* mensaje inválido ignorado */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setState((s) => ({ ...s, status: "offline" }));
        retryRef.current += 1;
        const delay = Math.min(30000, 2000 * 2 ** retryRef.current);
        setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return state;
}