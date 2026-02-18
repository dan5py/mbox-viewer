"use client";

import Image from "next/image";
import { Download, FileText, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmailAttachment } from "~/types/files";
import {
  downloadAttachment,
  formatSize,
  isImageType,
  isPdfType,
  isTextType,
} from "~/lib/email-utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";

export interface AttachmentPreviewDialogProps {
  attachment: EmailAttachment | null;
  previewObjectUrl: string | null;
  onClose: () => void;
}

function decodeTextAttachmentData(
  attachment: EmailAttachment,
  fallbackText: string
): string {
  if (attachment.encoding !== "base64") {
    return attachment.data;
  }

  const normalized = attachment.data.replace(/\s/g, "");
  const isValidBase64 =
    normalized.length > 0 &&
    normalized.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(normalized);

  if (!isValidBase64) {
    return fallbackText;
  }

  const binaryData = atob(normalized);
  const bytes = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i);
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export default function AttachmentPreviewDialog({
  attachment,
  previewObjectUrl,
  onClose,
}: AttachmentPreviewDialogProps) {
  const t = useTranslations("Viewer");

  return (
    <Dialog open={!!attachment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100dvw-1rem)] max-w-none max-h-none gap-0 p-0 sm:h-[calc(100dvh-4rem)] sm:w-[calc(100dvw-4rem)] sm:max-w-[calc(100dvw-4rem)] sm:max-h-[calc(100dvh-4rem)] flex flex-col">
        <DialogHeader className="border-b px-4 pt-4 pb-3 shrink-0 sm:px-6 sm:pt-6 sm:pb-4">
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate flex-1 mr-4" title={attachment?.filename}>
              {attachment?.filename}
            </span>
            <div className="flex items-center gap-2 shrink-0 pr-6">
              {attachment && (
                <>
                  <Badge
                    variant="secondary"
                    className="text-xs h-8 border border-foreground/5"
                  >
                    {attachment.mimeType.split("/")[1]?.toUpperCase() ||
                      attachment.mimeType}
                  </Badge>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (attachment) {
                        downloadAttachment(attachment);
                      }
                    }}
                  >
                    <Download className="size-4 mr-2" />
                    {t("preview.download")}
                    <span className="text-xs text-muted-foreground">
                      ({formatSize(attachment.size)})
                    </span>
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {attachment && (
            <>
              {isImageType(attachment.mimeType) ? (
                <div className="relative flex items-center justify-center w-full h-full min-h-[400px]">
                  {previewObjectUrl ? (
                    <Image
                      src={previewObjectUrl}
                      alt={attachment.filename}
                      fill
                      unoptimized
                      sizes="100vw"
                      className="max-w-full max-h-[calc(100dvh-10rem)] object-contain rounded-lg border border-border/40 bg-background"
                    />
                  ) : (
                    <div className="flex items-center justify-center">
                      <Spinner
                        className="size-8"
                        label={t("preview.loading")}
                      />
                    </div>
                  )}
                </div>
              ) : isPdfType(attachment.mimeType) ? (
                <div className="w-full h-full min-h-[600px]">
                  {previewObjectUrl ? (
                    <iframe
                      src={previewObjectUrl}
                      className="w-full h-full border border-border/40 rounded-lg"
                      title={attachment.filename}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Spinner
                        className="size-8"
                        label={t("preview.loading")}
                      />
                    </div>
                  )}
                </div>
              ) : isTextType(attachment.mimeType) ? (
                <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                  <pre className="text-sm whitespace-pre-wrap font-mono text-foreground overflow-x-auto">
                    {decodeTextAttachmentData(
                      attachment,
                      t("preview.attachmentPreviewError")
                    )}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
                  <FileText className="size-16 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium mb-2">
                      {t("preview.attachmentPreviewNotAvailable")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("preview.attachmentPreviewNotAvailableDescription")}
                    </p>
                  </div>
                  <Button onClick={() => downloadAttachment(attachment)}>
                    <Download className="size-4 mr-2" />
                    {t("preview.download")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
