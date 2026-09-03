"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-right font-mono">
      <div className="text-sm tracking-widest text-text">
        {now.toLocaleTimeString("es-MX", { hour12: false })}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-faint">
        {now.toLocaleDateString("es-MX", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
      </div>
    </div>
  );
}