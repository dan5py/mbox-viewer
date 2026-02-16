"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Download,
  ExternalLink,
  FileText,
  Paperclip,
  Search,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { EmailAttachment, MailFile } from "~/types/files";
import { downloadAttachment, formatSize } from "~/lib/email-utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";

export interface IndexedAttachment {
  attachmentId: string;
  attachmentIndex: number;
  filename: string;
  mimeType: string;
  size: number;
  messageIndex: number;
  messageSubject: string;
  messageFrom: string;
  messageDate: string;
}

export interface AttachmentsCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFile: MailFile | undefined;
  loadMessage: (
    fileId: string,
    messageIndex: number,
    options?: { cache?: boolean }
  ) => Promise<{
    attachments?: EmailAttachment[];
    subject: string;
    from: string;
    date: Date;
  }>;
  onSelectMessage: (index: number) => void;
  onPreviewAttachment: (att: EmailAttachment) => void;
}

export default function AttachmentsCenterDialog({
  open,
  onOpenChange,
  currentFile,
  loadMessage,
  onSelectMessage,
  onPreviewAttachment,
}: AttachmentsCenterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && currentFile && (
        <AttachmentsCenterContent
          currentFile={currentFile}
          loadMessage={loadMessage}
          onOpenChange={onOpenChange}
          onSelectMessage={onSelectMessage}
          onPreviewAttachment={onPreviewAttachment}
        />
      )}
    </Dialog>
  );
}

function AttachmentsCenterContent({
  currentFile,
  loadMessage,
  onOpenChange,
  onSelectMessage,
  onPreviewAttachment,
}: {
  currentFile: MailFile;
  loadMessage: AttachmentsCenterDialogProps["loadMessage"];
  onOpenChange: (open: boolean) => void;
  onSelectMessage: (index: number) => void;
  onPreviewAttachment: (att: EmailAttachment) => void;
}) {
  "use no memo";
  const t = useTranslations("Viewer");
  const [indexedAttachments, setIndexedAttachments] = useState<
    IndexedAttachment[]
  >([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Build attachment index on mount
  useEffect(() => {
    if (!currentFile.messageBoundaries) {
      return;
    }

    let cancelled = false;

    const indexAttachments = async () => {
      setIsIndexing(true);
      setIndexProgress(0);

      const results: IndexedAttachment[] = [];
      const boundaries = currentFile.messageBoundaries!;
      const total = boundaries.length;

      for (let i = 0; i < total; i++) {
        if (cancelled) return;

        const boundary = boundaries[i];
        const preview = boundary.preview;

        try {
          const message = await loadMessage(currentFile.id, boundary.index, {
            cache: false,
          });

          if (message.attachments && message.attachments.length > 0) {
            for (let j = 0; j < message.attachments.length; j++) {
              const att = message.attachments[j];
              results.push({
                attachmentId: att.id,
                attachmentIndex: j,
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.size,
                messageIndex: boundary.index,
                messageSubject:
                  preview?.subject || message.subject || "(No Subject)",
                messageFrom: preview?.from || message.from || "Unknown",
                messageDate: preview?.date || message.date.toISOString(),
              });
            }
          }
        } catch {
          // Skip messages that fail to load
        }

        if ((i + 1) % 10 === 0 || i + 1 === total) {
          setIndexProgress(Math.round(((i + 1) / total) * 100));
        }
      }

      if (!cancelled) {
        setIndexedAttachments(results);
        setIsIndexing(false);
        setIndexProgress(100);
      }
    };

    void indexAttachments();

    return () => {
      cancelled = true;
    };
  }, [currentFile.id, currentFile.messageBoundaries, loadMessage]);

  // Filter attachments by search query
  const filteredAttachments = useMemo(() => {
    if (!searchQuery.trim()) return indexedAttachments;

    const query = searchQuery.toLowerCase();
    return indexedAttachments.filter(
      (item) =>
        item.filename.toLowerCase().includes(query) ||
        item.mimeType.toLowerCase().includes(query) ||
        item.messageSubject.toLowerCase().includes(query) ||
        item.messageFrom.toLowerCase().includes(query)
    );
  }, [indexedAttachments, searchQuery]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is intentionally used to handle large attachment lists.
  const rowVirtualizer = useVirtualizer({
    count: filteredAttachments.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 96,
    overscan: 8,
  });

  const loadAttachmentForItem = useCallback(
    async (item: IndexedAttachment) => {
      const message = await loadMessage(currentFile.id, item.messageIndex, {
        cache: false,
      });
      const attachments = message.attachments;
      if (!attachments || attachments.length === 0) {
        return null;
      }

      return (
        attachments[item.attachmentIndex] ??
        attachments.find((att) => att.id === item.attachmentId) ??
        null
      );
    },
    [currentFile.id, loadMessage]
  );

  const handleJumpToMessage = useCallback(
    (messageIndex: number) => {
      onOpenChange(false);
      requestAnimationFrame(() => {
        onSelectMessage(messageIndex);
      });
    },
    [onOpenChange, onSelectMessage]
  );

  const handlePreview = useCallback(
    async (item: IndexedAttachment) => {
      const attachment = await loadAttachmentForItem(item);
      if (!attachment) {
        return;
      }

      onPreviewAttachment(attachment);
    },
    [loadAttachmentForItem, onPreviewAttachment]
  );

  const handleDownload = useCallback(
    async (item: IndexedAttachment) => {
      const attachment = await loadAttachmentForItem(item);
      if (!attachment) {
        return;
      }

      downloadAttachment(attachment);
    },
    [loadAttachmentForItem]
  );

  return (
    <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100dvw-1rem)] max-w-none max-h-none gap-0 p-0 sm:h-[calc(100dvh-4rem)] sm:w-[calc(100dvw-4rem)] sm:max-w-3xl sm:max-h-[calc(100dvh-4rem)] flex flex-col">
      <DialogHeader className="border-b px-4 pt-4 pb-3 shrink-0 sm:px-6 sm:pt-6 sm:pb-4">
        <DialogTitle className="flex items-center gap-2">
          <Paperclip className="size-5" />
          {t("attachmentsCenter.title")}
          {!isIndexing && indexedAttachments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {indexedAttachments.length}
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>
          {t("attachmentsCenter.description")}
        </DialogDescription>
      </DialogHeader>

      {/* Search */}
      <div className="border-b px-4 py-3 sm:px-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("attachmentsCenter.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm pl-9 pr-9"
            disabled={isIndexing}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4 sm:p-6">
        {isIndexing ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Spinner
              className="size-8 text-primary"
              label={t("attachmentsCenter.indexing")}
            />
            <div className="text-center">
              <p className="text-sm font-medium">
                {t("attachmentsCenter.indexing")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("attachmentsCenter.indexingProgress", {
                  progress: indexProgress,
                })}
              </p>
            </div>
          </div>
        ) : filteredAttachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Paperclip className="size-12 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? t("attachmentsCenter.noSearchResults")
                : t("attachmentsCenter.noAttachments")}
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {searchQuery && (
              <p className="text-xs text-muted-foreground mb-2">
                {t("attachmentsCenter.resultsCount", {
                  count: filteredAttachments.length,
                })}
              </p>
            )}
            <div
              ref={scrollContainerRef}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <div
                className="relative w-full"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filteredAttachments[virtualRow.index];
                  if (!item) {
                    return null;
                  }

                  return (
                    <div
                      key={`${item.messageIndex}-${item.attachmentId}-${virtualRow.index}`}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="absolute left-0 top-0 w-full pb-3"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <div className="flex items-center justify-between p-3 gap-3 rounded-lg border border-border/40 bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="size-12 flex items-center justify-center rounded-md border border-border bg-muted shrink-0">
                            <FileText className="size-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              title={item.filename}
                            >
                              {item.filename}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4"
                              >
                                {item.mimeType.split("/")[1]?.toUpperCase() ||
                                  item.mimeType}
                              </Badge>
                              <span>{formatSize(item.size)}</span>
                            </div>
                            <p
                              className="text-xs text-muted-foreground mt-1 truncate"
                              title={item.messageSubject}
                            >
                              {item.messageSubject}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              handleJumpToMessage(item.messageIndex)
                            }
                            title={t("attachmentsCenter.jumpToMessage")}
                          >
                            <ExternalLink className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => void handlePreview(item)}
                            title={t("preview.preview")}
                          >
                            <Search className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => void handleDownload(item)}
                            title={t("preview.download")}
                          >
                            <Download className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}
