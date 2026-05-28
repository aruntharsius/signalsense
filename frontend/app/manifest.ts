import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "SignalSense",
    short_name:       "SignalSense",
    description:      "AI-powered stock technical analysis",
    start_url:        "/dashboard",
    display:          "standalone",
    background_color: "#0d1628",
    theme_color:      "#0d1628",
    orientation:      "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
