"use client";

import { useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { SeismicEvent } from "@/lib/types";

export function Waveform({ lastEvent }: { lastEvent: SeismicEvent | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);
  const spikeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const mid = h / 2;
      ctx.beginPath();
      ctx.lineWidth = 1.6 * (window.devicePixelRatio || 1);
      ctx.strokeStyle = "#2de1c2";
      ctx.shadowColor = "rgba(45,225,194,.55)";
      ctx.shadowBlur = 8;

      const points = 260;
      for (let i = 0; i < points; i++) {
        const x = (i / points) * w;
        let y = mid + Math.sin(i * 0.18 + tRef.current) * (h * 0.05);
        y += Math.sin(i * 0.5 + tRef.current * 2) * (h * 0.02);
        if (spikeRef.current > 0 && i > points - 40) {
          y += Math.sin(i * 1.4 + tRef.current * 6) * (h * 0.34) * (spikeRef.current / 40);
        }
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      tRef.current += 0.055;
      if (spikeRef.current > 0) spikeRef.current--;
      if (Math.random() < 0.004) spikeRef.current = 40;

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const mag = lastEvent?.magnitude;
  const level =
    mag != null
      ? mag >= 6
        ? "alerta"
        : mag >= 4.5
          ? "precaucion"
          : "normal"
      : "normal";
  const levelColor =
    level === "alerta" ? "#ff3b4e" : level === "precaucion" ? "#ffb020" : "#2de1c2";

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>TRAZA SISMOGRÁFICA · CANAL BHZ</CardTitle>
        <span className="text-[10px] uppercase tracking-widest text-faint">
          amplitud normalizada
        </span>
      </CardHeader>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="h-[170px] w-full"
          style={{ display: "block" }}
        />
        {lastEvent && (
          <div className="absolute right-4 top-4 text-right">
            <div
              className="font-sans text-3xl font-bold"
              style={{ color: levelColor }}
            >
              M {lastEvent.magnitude.toFixed(1)}
            </div>
            <div className="text-[11px] text-dim">
              {lastEvent.region_text} · prof. {lastEvent.depth_km.toFixed(0)} km
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}