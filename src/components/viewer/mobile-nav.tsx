"use client";

import { useTranslations } from "next-intl";
import { Eye, FileText, Mail } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export interface MobileNavProps {
  mobileActivePane: "messages" | "preview";
  isMobileFilesSheetOpen: boolean;
  onOpenFilesSheet: () => void;
  onSetActivePane: (pane: "messages" | "preview") => void;
}

export function MobileNav({
  mobileActivePane,
  isMobileFilesSheetOpen,
  onOpenFilesSheet,
  onSetActivePane,
}: MobileNavProps) {
  const t = useTranslations("Viewer");

  return (
    <div
      className="sticky bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3 gap-1 p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFilesSheet}
          aria-label={t("mobileNav.openFiles")}
          className={cn(
            "h-10 justify-center gap-2",
            isMobileFilesSheetOpen && "bg-muted text-foreground"
          )}
        >
          <FileText className="size-4" />
          <span>{t("mobileNav.files")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSetActivePane("messages")}
          className={cn(
            "h-10 justify-center gap-2",
            mobileActivePane === "messages" && "bg-muted text-foreground"
          )}
        >
          <Mail className="size-4" />
          <span>{t("mobileNav.messages")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSetActivePane("preview")}
          className={cn(
            "h-10 justify-center gap-2",
            mobileActivePane === "preview" && "bg-muted text-foreground"
          )}
        >
          <Eye className="size-4" />
          <span>{t("mobileNav.preview")}</span>
        </Button>
      </div>
    </div>
  );
}
