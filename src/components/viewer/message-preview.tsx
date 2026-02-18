"use client";

import Image from "next/image";
import { formatDate } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { it } from "date-fns/locale/it";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  CodeXml,
  Download,
  Eye,
  FileText,
  Mail,
  Maximize2,
  Paperclip,
  TextInitial,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { EmailAttachment, EmailMessage } from "~/types/files";
import {
  downloadAttachment,
  formatEmailAddresses,
  formatSize,
  getAvatarColor,
  getInitials,
} from "~/lib/email-utils";
import { PREVIEWABLE_MIME_TYPES } from "~/lib/mime-types";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import HtmlRenderer from "~/components/viewer/html-renderer";
import { RecipientList } from "~/components/viewer/recipient-list";

export interface MessagePreviewProps {
  mobileActivePane: "messages" | "preview";
  selectedMessageData: EmailMessage | null;
  selectedMessageIndex: number | null;
  loadingMessage: boolean;
  effectiveTab: string;
  hasBody: boolean;
  hasAttachments: boolean;
  tab: string;
  setTab: (tab: string) => void;
  bodyTab: "html" | "text";
  setBodyTab: (tab: "html" | "text") => void;
  headerExpanded: boolean;
  setHeaderExpanded: (expanded: boolean) => void;
  expandedRecipients: { to: boolean; cc: boolean };
  onToggleRecipientExpanded: (type: "to" | "cc") => void;
  onOpenFullscreen: () => void;
  onPreviewAttachment: (att: EmailAttachment) => void;
}

export function MessagePreview({
  mobileActivePane,
  selectedMessageData,
  selectedMessageIndex,
  loadingMessage,
  effectiveTab,
  hasBody,
  hasAttachments,
  tab,
  setTab,
  bodyTab,
  setBodyTab,
  headerExpanded,
  setHeaderExpanded,
  expandedRecipients,
  onToggleRecipientExpanded,
  onOpenFullscreen,
  onPreviewAttachment,
}: MessagePreviewProps) {
  const t = useTranslations("Viewer");
  const locale = useLocale();
  const dateLocale = locale === "it" ? it : enUS;

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col bg-background overflow-hidden",
        mobileActivePane !== "preview" && "hidden md:flex"
      )}
    >
      {selectedMessageData &&
      selectedMessageIndex !== null &&
      selectedMessageData.id === `msg-${selectedMessageIndex}` ? (
        <>
          {/* Message Header */}
          <div className="border-b border-border/40 bg-muted/20 shrink-0 overflow-y-auto max-h-[40vh]">
            <div className="p-6 space-y-3">
              {/* Subject */}
              <div>
                <h2 className="text-lg font-semibold text-foreground line-clamp-2">
                  {selectedMessageData.subject || (
                    <span className="italic text-muted-foreground">
                      {t("preview.noSubject")}
                    </span>
                  )}
                </h2>
              </div>

              {/* Compact header - always visible */}
              <div className="flex gap-3">
                {/* Avatar */}
                <div
                  className={cn(
                    "size-12 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0",
                    getAvatarColor(selectedMessageData.from)
                  )}
                >
                  {getInitials(selectedMessageData.from)}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Sender name and date */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {(() => {
                        const primarySender =
                          formatEmailAddresses(selectedMessageData.from)
                            .filter((address) => address.name || address.email)
                            .map((address) => address.name || address.email)
                            .at(0) || t("preview.unknown");

                        return (
                          <h3
                            className="font-semibold text-base text-foreground truncate"
                            title={primarySender}
                          >
                            {primarySender}
                          </h3>
                        );
                      })()}
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDate(selectedMessageData.date, "MMM d, p", {
                        locale: dateLocale,
                      })}
                    </div>
                  </div>

                  {/* Recipients and badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="text-sm text-muted-foreground truncate min-w-0"
                      title={selectedMessageData.to || t("preview.unknown")}
                    >
                      <span className="font-medium">{t("preview.to")}: </span>
                      <span>
                        {(() => {
                          const toAddresses = formatEmailAddresses(
                            selectedMessageData.to
                          ).filter((address) => address.name || address.email);
                          const firstRecipient =
                            toAddresses[0]?.name ||
                            toAddresses[0]?.email ||
                            t("preview.unknown");

                          if (toAddresses.length === 1) {
                            return firstRecipient;
                          } else if (toAddresses.length > 1) {
                            return `${firstRecipient}, ${t("preview.more", {
                              count: toAddresses.length - 1,
                            })}`;
                          }
                          return t("preview.unknown");
                        })()}
                      </span>
                    </div>

                    {/* Badges and expand button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* CC indicator */}
                      {selectedMessageData.cc && (
                        <Badge variant="outline" className="text-xs h-5">
                          {t("preview.cc")}:{" "}
                          {formatEmailAddresses(selectedMessageData.cc).length}
                        </Badge>
                      )}

                      {/* Attachments indicator */}
                      {selectedMessageData.attachments &&
                        selectedMessageData.attachments.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Paperclip className="size-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs h-5">
                              {selectedMessageData.attachments.length}
                            </Badge>
                          </div>
                        )}

                      {/* Expand/Collapse button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHeaderExpanded(!headerExpanded)}
                        className="h-6 px-2 text-xs -mr-2"
                      >
                        {headerExpanded ? (
                          <>
                            <ChevronUp className="size-3.5 mr-1" />
                            {t("preview.less")}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="size-3.5 mr-1" />
                            {t("preview.details")}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {headerExpanded && (
                <div className="pt-3 border-t border-border/40">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <User className="size-3" />
                          {t("preview.from")}
                        </label>
                        <div className="space-y-1.5">
                          {formatEmailAddresses(selectedMessageData.from).map(
                            (addr, idx) => (
                              <div key={idx} className="flex flex-col gap-0.5">
                                {addr.name ? (
                                  <>
                                    <span className="text-sm font-medium text-foreground">
                                      {addr.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {addr.email}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-sm text-foreground">
                                    {addr.email || t("preview.unknown")}
                                  </span>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Mail className="size-3" />
                          {t("preview.to")}
                          {formatEmailAddresses(selectedMessageData.to).length >
                            1 && (
                            <Badge variant="secondary" className="text-xs">
                              {
                                formatEmailAddresses(selectedMessageData.to)
                                  .length
                              }
                            </Badge>
                          )}
                        </label>
                        <RecipientList
                          addresses={formatEmailAddresses(
                            selectedMessageData.to
                          )}
                          maxVisible={2}
                          type="to"
                          isExpanded={expandedRecipients.to}
                          onToggleExpanded={() =>
                            onToggleRecipientExpanded("to")
                          }
                        />
                      </div>
                      {selectedMessageData.cc && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                            {t("preview.cc")}
                            {formatEmailAddresses(selectedMessageData.cc)
                              .length > 1 && (
                              <Badge variant="secondary" className="text-xs">
                                {
                                  formatEmailAddresses(selectedMessageData.cc)
                                    .length
                                }
                              </Badge>
                            )}
                          </label>
                          <RecipientList
                            addresses={formatEmailAddresses(
                              selectedMessageData.cc
                            )}
                            maxVisible={2}
                            type="cc"
                            isExpanded={expandedRecipients.cc}
                            onToggleExpanded={() =>
                              onToggleRecipientExpanded("cc")
                            }
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Calendar className="size-3" />
                          {t("preview.date")}
                        </label>
                        <p className="text-sm text-foreground">
                          {formatDate(selectedMessageData.date, "PPP p", {
                            locale: dateLocale,
                          })}
                        </p>
                      </div>
                      {selectedMessageData.attachments &&
                        selectedMessageData.attachments.length > 0 && (
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                              <Paperclip className="size-3" />
                              {t("preview.attachments")}
                            </label>
                            <p className="text-sm text-foreground">
                              {t("preview.attachmentCount", {
                                count: selectedMessageData.attachments.length,
                              })}
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Message Tabs */}
          <Tabs
            value={effectiveTab}
            onValueChange={setTab}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <TabsList className="w-full rounded-none border-b shrink-0">
              {hasBody ? (
                <TabsTrigger value="body">{t("preview.body")}</TabsTrigger>
              ) : null}
              {hasAttachments && (
                <TabsTrigger value="attachments">
                  {t("preview.attachments")} (
                  {selectedMessageData.attachments?.length})
                </TabsTrigger>
              )}
              <TabsTrigger value="headers">{t("preview.headers")}</TabsTrigger>
            </TabsList>

            {/* Body Tab */}
            {selectedMessageData.htmlBody || selectedMessageData.body ? (
              <TabsContent
                value="body"
                className="flex-1 min-h-0 flex flex-col overflow-hidden m-0 p-0 data-[state=active]:flex"
              >
                {selectedMessageData.htmlBody ? (
                  <Tabs
                    defaultValue="html"
                    value={bodyTab}
                    onValueChange={(value) =>
                      setBodyTab(value as "html" | "text")
                    }
                    className="flex-1 flex flex-col overflow-hidden min-h-0 gap-0"
                  >
                    <div className="shrink-0 flex items-center justify-between px-6 pt-2 pb-4 border-b">
                      <TabsList className="p-0">
                        <TabsTrigger value="html" className="text-xs">
                          <CodeXml />
                          {t("preview.html")}
                        </TabsTrigger>
                        <TabsTrigger value="text" className="text-xs">
                          <TextInitial />
                          {t("preview.plainText")}
                        </TabsTrigger>
                      </TabsList>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenFullscreen}
                        aria-label={t("preview.fullscreen")}
                      >
                        <Maximize2 />
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <TabsContent value="html" className="p-6 pb-12">
                        <div className="bg-white rounded-lg p-4 border border-border/40">
                          <HtmlRenderer
                            html={selectedMessageData.htmlBody}
                            className="w-full"
                            attachments={selectedMessageData.attachments}
                          />
                        </div>
                      </TabsContent>
                      <TabsContent value="text" className="p-6 pb-12">
                        <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                          <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                            {selectedMessageData.body}
                          </pre>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="shrink-0 flex items-center justify-end px-6 pt-2 pb-4 border-b">
                      <Button
                        variant="ghost"
                        onClick={onOpenFullscreen}
                        aria-label={t("preview.fullscreen")}
                      >
                        <Maximize2 />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 pb-12">
                      <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                        <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                          {selectedMessageData.body}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            ) : null}

            {/* Headers Tab */}
            <TabsContent
              value="headers"
              className="flex-1 overflow-y-auto min-h-0 p-6 pb-12"
            >
              <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                <pre className="text-xs font-mono text-foreground overflow-x-auto">
                  {JSON.stringify(selectedMessageData.headers, null, 2)}
                </pre>
              </div>
            </TabsContent>

            {/* Attachments Tab */}
            {selectedMessageData.attachments &&
            selectedMessageData.attachments.length > 0 ? (
              <TabsContent
                value="attachments"
                className="flex-1 overflow-y-auto min-h-0 p-6 pb-12"
              >
                <div className="space-y-3">
                  {selectedMessageData.attachments.map(
                    (att: EmailAttachment) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-4 gap-4 rounded-lg border border-border/40 bg-card hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {PREVIEWABLE_MIME_TYPES.includes(att.mimeType) ? (
                            <Image
                              src={`data:${att.mimeType};base64,${att.data}`}
                              alt={att.filename}
                              width={100}
                              height={100}
                              className="size-16 object-scale-down rounded-md border border-border bg-background"
                              loading="lazy"
                              unoptimized
                            />
                          ) : (
                            <div className="size-16 flex items-center justify-center rounded-md border border-border bg-muted">
                              <FileText className="size-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-medium truncate text-sm mb-1"
                              title={att.filename}
                            >
                              {att.filename}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {att.mimeType.split("/")[1]?.toUpperCase() ||
                                  att.mimeType}
                              </Badge>
                              <span>•</span>
                              <span>{formatSize(att.size)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPreviewAttachment(att)}
                            aria-label={t("preview.preview")}
                          >
                            <Eye className="size-4 mr-2" />
                            {t("preview.preview")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadAttachment(att)}
                          >
                            <Download className="size-4 mr-2" />
                            {t("preview.download")}
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </TabsContent>
            ) : null}
          </Tabs>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          {loadingMessage || selectedMessageIndex !== null ? (
            <>
              <Spinner
                className="size-16 mx-auto mb-4 text-primary"
                label={t("preview.loading")}
              />
              <p className="text-sm font-medium text-foreground mb-1">
                {t("preview.loading")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("preview.loadingMessageContent")}
              </p>
            </>
          ) : (
            <>
              <div className="size-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Mail className="size-10 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("preview.selectMessage")}
              </h3>
              <div className="text-sm text-muted-foreground max-w-sm">
                {t("preview.useArrows.use")}{" "}
                <KbdGroup>
                  <Kbd>↑</Kbd>
                  <span>{t("preview.useArrows.or")}</span>
                  <Kbd>↓</Kbd>
                </KbdGroup>{" "}
                {t("preview.useArrows.toNavigate")}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
