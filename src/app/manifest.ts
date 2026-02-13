import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MBOX Viewer",
    short_name: "MBOX Viewer",
    description:
      "A modern, fast, and privacy-focused MBOX file viewer that runs directly in your browser.",
    start_url: "/viewer",
    scope: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#22c55e",
    lang: "en",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
