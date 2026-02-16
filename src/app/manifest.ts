import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import { Locale, localeCookieName } from "~/i18n/config";
import { getPreferredLocale, resolveSupportedLocale } from "~/i18n/locale";

const manifestDescriptions: Record<Locale, string> = {
  en: "A modern, fast, and privacy-focused MBOX file viewer that runs directly in your browser.",
  it: "Un visualizzatore MBOX moderno, veloce e orientato alla privacy che funziona direttamente nel browser.",
};

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const preferredLocale = await getPreferredLocale();
  const activeLocale = resolveSupportedLocale(
    cookieStore.get(localeCookieName)?.value,
    preferredLocale
  );

  return {
    name: "MBOX Viewer",
    short_name: "MBOX Viewer",
    description: manifestDescriptions[activeLocale],
    start_url: "/viewer",
    scope: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#22c55e",
    lang: activeLocale,
    orientation: "portrait",
    icons: [
      {
        src: "icons/icon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: "icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: "icons/icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
      },
      {
        src: "icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "icons/icon-256x256.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
      },
      {
        src: "icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
