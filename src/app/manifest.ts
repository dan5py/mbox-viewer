import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import {
  defaultLocale,
  Locale,
  localeCookieName,
  locales,
} from "~/i18n/config";
import { getPreferredLocale } from "~/i18n/locale";

const manifestDescriptions: Record<Locale, string> = {
  en: "A modern, fast, and privacy-focused MBOX file viewer that runs directly in your browser.",
  it: "Un visualizzatore MBOX moderno, veloce e orientato alla privacy che funziona direttamente nel browser.",
};

function resolveLocale(
  cookieLocale: string | undefined,
  preferredLocale: Locale
): Locale {
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  return preferredLocale || defaultLocale;
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const preferredLocale = await getPreferredLocale();
  const activeLocale = resolveLocale(
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
