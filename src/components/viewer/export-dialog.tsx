"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

import { ExportFormat } from "~/lib/message-export";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Spinner } from "~/components/ui/spinner";

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  exportFormat: ExportFormat;
  setExportFormat: (format: ExportFormat) => void;
  includeAttachmentsInExport: boolean;
  setIncludeAttachmentsInExport: (include: boolean) => void;
  isExporting: boolean;
  exportProgress: number;
  onExport: () => void;
  onCancelExport: () => void;
}

export default function ExportDialog({
  open,
  onOpenChange,
  selectedCount,
  exportFormat,
  setExportFormat,
  includeAttachmentsInExport,
  setIncludeAttachmentsInExport,
  isExporting,
  exportProgress,
  onExport,
  onCancelExport,
}: ExportDialogProps) {
  const t = useTranslations("Viewer");

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!isExporting) {
          onOpenChange(open);
        }
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!isExporting}>
        <DialogHeader>
          <DialogTitle>{t("export.title")}</DialogTitle>
          <DialogDescription>
            {t("export.description", { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{t("export.formatLabel")}</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as ExportFormat)}
              disabled={isExporting}
              className="grid grid-cols-3 gap-2"
            >
              <div className="flex items-center space-x-2 rounded-md border p-2">
                <RadioGroupItem value="mbox" id="export-mbox" />
                <Label htmlFor="export-mbox" className="cursor-pointer">
                  {t("export.formats.mbox")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-2">
                <RadioGroupItem value="txt" id="export-txt" />
                <Label htmlFor="export-txt" className="cursor-pointer">
                  {t("export.formats.txt")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-2">
                <RadioGroupItem value="html" id="export-html" />
                <Label htmlFor="export-html" className="cursor-pointer">
                  {t("export.formats.html")}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                {t("export.includeAttachments")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("export.includeAttachmentsHint")}
              </p>
            </div>
            <Checkbox
              checked={includeAttachmentsInExport}
              onCheckedChange={(checked) =>
                setIncludeAttachmentsInExport(checked === true)
              }
              aria-label={t("export.includeAttachments")}
              disabled={isExporting}
            />
          </div>

          {isExporting && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("export.progress", { progress: exportProgress })}
              </p>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={
              isExporting ? onCancelExport : () => onOpenChange(false)
            }
          >
            {isExporting ? t("export.cancelInProgress") : t("export.cancel")}
          </Button>
          <Button
            onClick={onExport}
            disabled={isExporting || selectedCount === 0}
          >
            {isExporting ? (
              <>
                <Spinner
                  className="size-4 mr-2"
                  label={t("export.exporting")}
                />
                {t("export.exporting")}
              </>
            ) : (
              <>
                <Download className="size-4 mr-2" />
                {t("export.confirm")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
