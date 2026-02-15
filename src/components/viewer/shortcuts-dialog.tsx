"use client";

import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Kbd, KbdGroup } from "~/components/ui/kbd";

export interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcutModifierLabel: string;
  clearPreviewShortcutLabel: string;
}

export default function ShortcutsDialog({
  open,
  onOpenChange,
  shortcutModifierLabel,
  clearPreviewShortcutLabel,
}: ShortcutsDialogProps) {
  const t = useTranslations("Viewer");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("selection.shortcuts.title")}</DialogTitle>
          <DialogDescription>
            {t("selection.shortcuts.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>?</Kbd>
              <Kbd>F1</Kbd>
              <Kbd>Help</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.openDialog")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>{shortcutModifierLabel}</Kbd>
              <Kbd>A</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.select")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>Shift</Kbd>
              <Kbd>{shortcutModifierLabel}</Kbd>
              <Kbd>A</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.clear")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>Shift</Kbd>
              <Kbd>Esc</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.resetFilters")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>{clearPreviewShortcutLabel}</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.clearPreview")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.navigateMessages")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.navigateLabels")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>Home</Kbd>
              <Kbd>End</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.jumpLabelsAndMenuItems")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>Shift</Kbd>
              <Kbd>{t("selection.shortcuts.clickKey")}</Kbd>
            </KbdGroup>
            <span>{t("selection.shortcuts.range")}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
