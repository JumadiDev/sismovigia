"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "@/lib/api";
import type { TelemetrySample } from "@/lib/types";

export type TelemetryStatus = "connecting" | "live" | "offline";

export interface TelemetryState {
  status: TelemetryStatus;
  samples: TelemetrySample[];
  error: string | null;
}

export function useTelemetry(station: string, active = true): TelemetryState {
  const [state, setState] = useState<TelemetryState>({
    status: "connecting",
    samples: [],
    error: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const stationRef = useRef(station);
  const activeRef = useRef(active);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!activeRef.current) return;
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setState((s) => ({ ...s, status: "live", error: null }));
      ws.send(JSON.stringify({ type: "subscribe:telemetry", station: stationRef.current }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "snapshot:telemetry" && msg.telemetry) {
          setState((s) => ({ ...s, samples: msg.telemetry, status: "live" }));
        } else if (msg.type === "telemetry:new" && msg.data) {
          setState((s) => {
            const sample = msg.data as TelemetrySample;
            if (sample.station_id !== stationRef.current) return s;
            const samples = [...s.samples, sample].slice(-400);
            return { ...s, samples };
          });
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
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    activeRef.current = active;
    if (active) {
      retryRef.current = 0;
      connect();
    }
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, connect]);

  useEffect(() => {
    stationRef.current = station;
    if (activeRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe:telemetry", station }));
    }
  }, [station]);

  return state;
}