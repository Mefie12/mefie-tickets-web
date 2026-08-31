import type { MetadataRoute } from "next";

/**
 * Installable gate-scanner PWA (docs/17 §15) — standalone display, no
 * service worker: the gate app is deliberately online-only.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mefie Gate",
    short_name: "Gate",
    description: "Door check-in scanner for Mefie events",
    start_url: "/gate",
    scope: "/gate",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a1b1e",
    theme_color: "#552efd",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
