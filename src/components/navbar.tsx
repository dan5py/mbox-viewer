"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";

export function Navbar({
  showViewerButton = false,
  showSettingsButton = true,
  borderless = false,
}: {
  showViewerButton?: boolean;
  showSettingsButton?: boolean;
  borderless?: boolean;
}) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav
      className={`${borderless ? "bg-transparent" : "border-b border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"} sticky top-0 z-50`}
    >
      <div className="px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icons/icon-192x192.png"
            alt="Logo"
            width={128}
            height={128}
            className="size-8 rounded-md border border-border/90"
            priority
          />
          <span className="text-xl font-bold">MBOX Viewer</span>
        </Link>
        <div className="flex items-center gap-3">
          {showSettingsButton && pathname !== "/settings" && (
            <Link href="/settings">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("Common.settingsAriaLabel")}
              >
                <Settings className="size-5" />
              </Button>
            </Link>
          )}
          {showViewerButton && (
            <Link href="/viewer">
              <Button variant="outline">{t("Home.viewer.open")}</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
