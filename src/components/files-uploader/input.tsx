"use client";

import { useCallback, useRef, useState } from "react";
import createMboxStore from "~/stores/mbox-store";
import { AlertCircle, Cloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDropzone } from "react-dropzone";

import { MailFile } from "~/types/files";
import { trackEvent } from "~/lib/analytics";
import { ByteReader } from "~/lib/byte-reader";
import { scanMessageBoundaries } from "~/lib/mbox-boundaries";
import { cn } from "~/lib/utils";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";

interface UploadProgress {
  fileName: string;
  progress: number;
  messageCount: number;
  speed: number;
  currentFileNumber: number;
  totalFiles: number;
}

function createSampleMboxFiles(): File[] {
  const sampleInbox = `From alice@example.com Fri Jan 01 09:10:00 2021
Date: Fri, 1 Jan 2021 09:10:00 +0000
From: Alice Example <alice@example.com>
To: Bob Example <bob@example.com>
Subject: =?UTF-8?B?V2VsY29tZSB0byBNQk9YIFZpZXdlciDwn5iK?=
Message-ID: <sample-1@example.com>
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: 8bit

Hello Bob,

This is a sample email so you can test search, selection, and export quickly.
It also includes emoji support: 🚀✨📬

Best,
Alice

From bob@example.com Fri Jan 01 10:25:00 2021
Date: Fri, 1 Jan 2021 10:25:00 +0000
From: Bob Example <bob@example.com>
To: Alice Example <alice@example.com>
Subject: Re: Welcome to MBOX Viewer
Message-ID: <sample-2@example.com>
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: 8bit

Thanks Alice!

I can already test:
- pagination
- keyboard shortcuts
- per-message exports
`;

  const sampleProject = `From manager@example.com Tue Feb 09 13:30:00 2021
Date: Tue, 9 Feb 2021 13:30:00 +0000
From: Project Manager <manager@example.com>
To: Team <team@example.com>
Cc: Stakeholders <stakeholders@example.com>
Subject: Sprint planning notes
Message-ID: <sample-3@example.com>
Content-Type: multipart/alternative; boundary="sample-boundary"

--sample-boundary
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: 8bit

Team,

Sprint planning is complete. See the HTML part for highlighted tasks ✅

--sample-boundary
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: 8bit

<html><body>
  <p><strong>Team,</strong></p>
  <p>Sprint planning is complete. Top priorities:</p>
  <ul>
    <li>Mobile responsive navigation</li>
    <li>Export polish</li>
    <li>Search performance</li>
  </ul>
  <p>Thanks! ✅</p>
</body></html>

--sample-boundary--
`;

  return [
    new File([sampleInbox], "sample-inbox.mbox", {
      type: "application/mbox",
    }),
    new File([sampleProject], "sample-project.mbox", {
      type: "application/mbox",
    }),
  ];
}

export function FileUploadInput({
  onUploadCompleteAction,
}: {
  onUploadCompleteAction?: () => void;
}) {
  "use no memo";
  const t = useTranslations();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    addFile,
    files,
    setIsUploading,
    isUploading,
    setIsParsing,
    isParsing,
  } = createMboxStore();

  const handleFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      // Create new AbortController for this import queue
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsUploading(true);
      setError(null);

      let uploadedCount = 0;
      const failures: string[] = [];

      try {
        for (let i = 0; i < acceptedFiles.length; i++) {
          if (abortController.signal.aborted) {
            break;
          }

          const file = acceptedFiles[i];
          const currentFileNumber = i + 1;
          const totalFiles = acceptedFiles.length;
          const startTime = Date.now();
          let lastUpdate = startTime;

          setIsParsing(false);
          setProgress({
            fileName: file.name,
            progress: 0,
            messageCount: 0,
            speed: 0,
            currentFileNumber,
            totalFiles,
          });

          try {
            // Create ByteReader for memory-efficient access
            const reader = new ByteReader(file);

            // Scan for message boundaries
            const boundaries = await scanMessageBoundaries(reader, {
              signal: abortController.signal,
              onProgress: (count, progressPercent) => {
                // Don't update if cancelled
                if (abortController.signal.aborted) {
                  return;
                }

                const now = Date.now();

                // Update UI every 500ms to avoid excessive re-renders
                if (now - lastUpdate > 500) {
                  const elapsed = (now - startTime) / 1000;
                  const speed = Math.round(count / (elapsed > 0 ? elapsed : 1));

                  setProgress({
                    fileName: file.name,
                    progress: progressPercent,
                    messageCount: count,
                    speed,
                    currentFileNumber,
                    totalFiles,
                  });
                  lastUpdate = now;
                }
              },
              onExtractPreview: () => {
                if (!abortController.signal.aborted) {
                  setIsParsing(true);
                }
              },
            });

            // Check if cancelled after scanning
            if (abortController.signal.aborted) {
              break;
            }

            if (boundaries.length === 0) {
              failures.push(file.name);
              continue;
            }

            // Create mail file object
            const mailFile: MailFile = {
              id: `file-${crypto.randomUUID()}`,
              name: file.name,
              rawFilename: file.name,
              typeId: "mbox",
              createdAt: new Date(),
              fileReader: reader,
              messageBoundaries: boundaries,
              messageCount: boundaries.length,
            };

            // Add file to store
            addFile(mailFile);
            uploadedCount++;

            // Final progress
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = Math.round(boundaries.length / elapsed);
            setProgress({
              fileName: file.name,
              progress: 100,
              messageCount: boundaries.length,
              speed,
              currentFileNumber,
              totalFiles,
            });

            trackEvent("file_uploaded", {
              message_count: boundaries.length,
            });
          } catch (err) {
            if (err instanceof Error && err.message === "Scan cancelled") {
              break;
            }
            failures.push(file.name);
          } finally {
            setIsParsing(false);
          }
        }

        if (abortController.signal.aborted) {
          // If at least one file was imported before cancellation, don't
          // surface a destructive error state.
          if (uploadedCount === 0) {
            setError(t("Viewer.input.importCancelled"));
          }
        } else if (failures.length > 0) {
          if (uploadedCount === 0) {
            setError(t("Viewer.input.scanFailed"));
          } else {
            setError(
              t("Viewer.input.partialFailure", {
                count: failures.length,
              })
            );
          }
        }

        if (uploadedCount > 0) {
          onUploadCompleteAction?.();
        }
      } finally {
        setProgress(null);
        setIsUploading(false);
        setIsParsing(false);
        abortControllerRef.current = null;
      }
    },
    [setIsUploading, setIsParsing, addFile, onUploadCompleteAction, t]
  );

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // Don't set to null here - let the finally block handle cleanup
    }
  }, []);

  const handleUseSamples = useCallback(() => {
    setError(null);
    const sampleFiles = createSampleMboxFiles();
    void handleFiles(sampleFiles);
  }, [handleFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        handleFiles(acceptedFiles);
      }
    },
    onDropRejected: (fileRejections) => {
      if (fileRejections.length > 0) {
        setError(
          t("Viewer.input.invalidType", {
            count: fileRejections.length,
          })
        );
      }
    },
    accept: {
      "application/mbox": [".mbox"],
      "text/plain": [".mbox", ".txt"],
      // For iOS Safari
      "application/octet-stream": [".mbox"],
    },
    multiple: true,
  });

  return (
    <div className="w-full max-w-md">
      {!isUploading && (
        <div
          {...getRootProps()}
          className={cn(
            "relative rounded-lg border-2 border-dashed p-8 text-center transition-all cursor-pointer",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            isUploading && "pointer-events-none opacity-50"
          )}
        >
          <input {...getInputProps()} disabled={isUploading} />
          <Cloud className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{t("Viewer.input.drop")}</p>
          <p className="text-xs text-muted-foreground">
            {t("Viewer.input.click")}
          </p>
        </div>
      )}

      {!isUploading && files.length === 0 && (
        <>
          <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border/60" />
            <span className="font-medium">{t("Viewer.input.or")}</span>
            <span className="h-px flex-1 bg-border/60" />
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-center">
            <p className="text-sm font-medium">
              {t("Viewer.input.samplesTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Viewer.input.samplesDescription")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleUseSamples}
            >
              {t("Viewer.input.useSamples")}
            </Button>
          </div>
        </>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isUploading ? (
        <div className="mt-4 flex flex-col gap-3 items-center rounded-lg bg-muted p-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="flex justify-center flex-1 font-medium text-sm h-5">
                {progress?.fileName ? (
                  progress.fileName
                ) : (
                  <Skeleton className="h-full w-32 bg-muted-foreground/40" />
                )}
              </div>
            </div>
            <div className="text-center text-xs text-muted-foreground mt-1">
              {t("Viewer.input.queueProgress", {
                current: progress?.currentFileNumber ?? 1,
                total: progress?.totalFiles ?? 1,
              })}
            </div>
            <div className="flex justify-center text-xs text-muted-foreground mt-1">
              {t("Viewer.messages", {
                count: progress?.messageCount ?? 0,
              })}{" "}
              •{" "}
              {isParsing ? (
                t("Viewer.parsing")
              ) : (
                <>{progress?.speed ?? 0} msg/s</>
              )}
            </div>
          </div>
          <Progress value={progress?.progress ?? 0} className="h-2" />
          <Button variant="outline" size="sm" onClick={handleCancel}>
            {t("Viewer.input.cancel")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
