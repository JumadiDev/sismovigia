import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SISMOVIGÍA · Panel de Monitoreo Sismológico",
  description: "Monitoreo sísmico de México — datos reales de SSN/USGS + IoT",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${plex.variable} ${grotesk.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}