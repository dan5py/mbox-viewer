"use client";

import { CodeXml, TextInitial } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmailMessage } from "~/types/files";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import HtmlRenderer from "~/components/viewer/html-renderer";

export interface FullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageData: EmailMessage | null;
  bodyTab: "html" | "text";
  setBodyTab: (tab: "html" | "text") => void;
}

export default function FullscreenDialog({
  open,
  onOpenChange,
  messageData,
  bodyTab,
  setBodyTab,
}: FullscreenDialogProps) {
  const t = useTranslations("Viewer");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100dvw-1rem)] max-w-none max-h-none gap-0 p-0 sm:h-[calc(100dvh-4rem)] sm:w-[calc(100dvw-4rem)] sm:max-w-[calc(100dvw-4rem)] sm:max-h-[calc(100dvh-4rem)] flex min-h-0 flex-col">
        <DialogHeader className="border-b px-4 pt-4 pb-3 shrink-0 sm:px-6 sm:pt-6 sm:pb-4">
          <DialogTitle className="flex min-h-10 flex-wrap items-start justify-between gap-2 pr-8">
            <span className="line-clamp-2 min-w-0 flex-1 text-left">
              {messageData?.subject || t("preview.noSubject")}
            </span>
            {messageData?.htmlBody && (
              <Tabs
                value={bodyTab}
                onValueChange={(value) => setBodyTab(value as "html" | "text")}
                className="shrink-0"
              >
                <TabsList className="ml-0 p-0">
                  <TabsTrigger value="html" className="text-xs">
                    <CodeXml />
                    {t("preview.html")}
                  </TabsTrigger>
                  <TabsTrigger value="text" className="text-xs">
                    <TextInitial />
                    {t("preview.plainText")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {messageData?.htmlBody ? (
            bodyTab === "html" ? (
              <div className="bg-white rounded-lg p-3 sm:p-4 border border-border/40">
                <HtmlRenderer
                  html={messageData.htmlBody}
                  className="w-full"
                  attachments={messageData.attachments}
                />
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-3 sm:p-4 border border-border/40">
                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                  {messageData.body}
                </pre>
              </div>
            )
          ) : messageData?.body ? (
            <div className="bg-muted/30 rounded-lg p-3 sm:p-4 border border-border/40">
              <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                {messageData.body}
              </pre>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
