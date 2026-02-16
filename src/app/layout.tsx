import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { cookies } from "next/headers";

import "./globals.css";

import Script from "next/script";
import { localeCookieName } from "~/i18n/config";
import { getPreferredLocale, resolveSupportedLocale } from "~/i18n/locale";
import { NuqsProvider } from "~/providers/nuqs-provider";
import { ThemeProvider } from "~/providers/theme-provider";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Toaster } from "sonner";

import { RegisterServiceWorker } from "~/components/pwa/register-sw";

const geist = Geist({
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

async function getActiveLocale() {
  const cookieStore = await cookies();
  const locale = await getPreferredLocale();
  return resolveSupportedLocale(
    cookieStore.get(localeCookieName)?.value,
    locale
  );
}

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getActiveLocale();
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: "MBOX Viewer",
    description: t("description"),
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icons/icon-48x48.png", sizes: "48x48", type: "image/png" },
        { url: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
        { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
        { url: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
        { url: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
        { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
        { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-256x256.png", sizes: "256x256", type: "image/png" },
        { url: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
        { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    appleWebApp: {
      capable: true,
      title: "MBOX Viewer",
      statusBarStyle: "default",
    },
  };
}

const isProduction = process.env.NODE_ENV === "production";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeLocale = await getActiveLocale();

  return (
    <html lang={activeLocale} suppressHydrationWarning>
      <head>
        {/* Umami analytics - PRODUCTION ONLY */}
        {isProduction &&
          process.env.UMAMI_SCRIPT_URL &&
          process.env.UMAMI_WEBSITE_ID && (
            <Script
              defer
              src={process.env.UMAMI_SCRIPT_URL}
              data-website-id={process.env.UMAMI_WEBSITE_ID}
            />
          )}
        {/* React Grab - DEV ONLY */}
        {!isProduction && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-enabled="true"
          />
        )}
      </head>
      <body className={`${geist.className} ${instrumentSerif.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NuqsProvider>
            <NextIntlClientProvider>
              <RegisterServiceWorker />
              {children}
              <Toaster />
            </NextIntlClientProvider>
          </NuqsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
