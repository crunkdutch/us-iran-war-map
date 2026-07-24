import type { Metadata } from "next";
import "./globals.css";
import HUDOverlay from "@/components/HUDOverlay";

export const metadata: Metadata = {
  title: "TACTICAL TRACKER // US-IRAN CONFLICT",
  description: "Real-time mapping of military engagements, strikes, and operations in the US-Iran conflict theater.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body>
        <HUDOverlay />
        {children}
      </body>
    </html>
  );
}
