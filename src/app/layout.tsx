import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";

import "./globals.css";

import Script from "next/script";
import { localeCookieName } from "~/i18n/config";
import { getPreferredLocale, resolveSupportedLocale } from "~/i18n/locale";
import { ThemeProvider } from "~/providers/theme-provider";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Toaster } from "sonner";

import { RegisterServiceWorker } from "~/components/pwa/register-sw";

const geist = Geist({
  subsets: ["latin"],
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
        { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icon-180.png", sizes: "180x180", type: "image/png" }],
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
      <body className={geist.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider>
            <RegisterServiceWorker />
            {children}
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
