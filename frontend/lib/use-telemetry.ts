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

export function useTelemetry(station: string): TelemetryState {
  const [state, setState] = useState<TelemetryState>({
    status: "connecting",
    samples: [],
    error: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const stationRef = useRef(station);

  useEffect(() => {
    stationRef.current = station;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe:telemetry", station }));
    }
  }, [station]);

  const connect = useCallback(() => {
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
          setState((s) => ({ ...s, samples: msg.telemetry }));
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
      setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return state;
}