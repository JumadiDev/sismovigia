"use client";

import { useEffect } from "react";
import { useLive } from "@/lib/use-live";
import { useNotifications } from "@/lib/use-notifications";
import { StatusBar } from "./status-bar";
import { MetricTiles } from "./metric-tiles";
import { EventTable, LatestEvent } from "./event-table";
import { NewsFeed } from "./news-feed";
import { StationPanel } from "./station-panel";
import { Waveform } from "./waveform";
import { ArchDiagram } from "./arch-diagram";
import { NotificationSettings } from "@/components/notification-settings";

export function Dashboard() {
  const live = useLive();
  const notifications = useNotifications();

  const alertLevel =
    live.metrics?.alert_level ?? (live.lastEvent ? live.lastEvent.alert_level : "normal");

  // Notificación discreta cuando llega un evento nuevo con magnitud alta
  useEffect(() => {
    if (live.lastEvent && live.lastEvent.magnitude >= 5.5) {
      const title = `Sismo M${live.lastEvent.magnitude.toFixed(1)} — ${live.lastEvent.region_text}`;
      try {
        new Notification(title);
      } catch {
        /* navegadores sin permiso */
      }
    }
  }, [live.lastEvent]);

  return (
    <div className="min-h-screen">
      <StatusBar
        status={live.status}
        alertLevel={alertLevel}
        notificationsEnabled={notifications.isSubscribed && notifications.permission === "granted"}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
        {live.error && (
          <div className="rounded-sm border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">
            Error cargando datos: {live.error}
          </div>
        )}

        <Waveform lastEvent={live.lastEvent ?? live.events[0] ?? null} />

        <MetricTiles metrics={live.metrics} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EventTable events={live.events} />
          </div>
          <div className="flex flex-col gap-4">
            <LatestEvent event={live.lastEvent ?? live.events[0] ?? null} />
            <StationPanel
              online={live.metrics?.stations.online ?? 0}
              total={live.metrics?.stations.total ?? 0}
            />
            <NotificationSettings />
          </div>
        </div>

        <NewsFeed news={live.news} />

        <ArchDiagram />

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[10px] uppercase tracking-widest text-faint">
          <span>SISMOVIGÍA · fuentes: SSN-UNAM · USGS · CIRES/SASMEX · red IoT propia</span>
          <span className="text-amber/70">no sustituye a SASMEX</span>
        </footer>
      </main>
    </div>
  );
}