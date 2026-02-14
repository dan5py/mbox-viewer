import JSZip from "jszip";

import { EmailAttachment, EmailMessage, MailFile } from "~/types/files";

export type ExportFormat = "html" | "mbox" | "txt";

interface ExportMessagesOptions {
  file: MailFile;
  selectedIndices: number[];
  format: ExportFormat;
  includeAttachments: boolean;
  localization: ExportLocalization;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  loadMessage: (fileId: string, messageIndex: number) => Promise<EmailMessage>;
}

interface ExportLocalization {
  locale: string;
  messageLabel: string;
  fromLabel: string;
  toLabel: string;
  ccLabel: string;
  bccLabel: string;
  dateLabel: string;
  subjectLabel: string;
  htmlDocumentTitle: string;
  htmlHeading: string;
  htmlExportedText: (count: number) => string;
}

const EXPORT_FILENAME_DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const TEXT_ENCODER = new TextEncoder();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeHtmlBodyForExport(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const blockedTags = doc.querySelectorAll(
    "script, iframe, object, embed, base, meta[http-equiv='refresh'], link[rel='import']"
  );
  blockedTags.forEach((node) => node.remove());

  const isUnsafeUrl = (url: string): boolean => {
    const normalized = url
      .replace(/[\u0000-\u001F\u007F\s]+/g, "")
      .toLowerCase();

    return (
      normalized.startsWith("javascript:") ||
      normalized.startsWith("vbscript:") ||
      normalized.startsWith("data:text/html") ||
      normalized.startsWith("data:text/javascript") ||
      normalized.startsWith("data:application/javascript")
    );
  };

  const allElements = doc.querySelectorAll("*");
  for (const element of allElements) {
    // Remove inline event handlers and javascript: URLs.
    const attributes = Array.from(element.attributes);
    for (const attribute of attributes) {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim().toLowerCase();

      if (attributeName.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      const isUrlAttribute =
        attributeName === "href" ||
        attributeName === "src" ||
        attributeName === "xlink:href" ||
        attributeName === "formaction";

      if (isUrlAttribute && isUnsafeUrl(attributeValue)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return doc.body?.innerHTML || "";
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function getFilenameBase(fileName: string, selectedCount: number): string {
  const baseName =
    fileName.replace(/\.[^/.]+$/, "").trim() || "mbox-exported-messages";
  const sanitizedBase =
    sanitizeFilenamePart(baseName) || "mbox-exported-messages";
  const timestamp = EXPORT_FILENAME_DATE_FORMATTER.format(new Date())
    .replace(/\s+/g, "_")
    .replace(/:/g, "-");

  return `${sanitizedBase}-${selectedCount}messages-${timestamp}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Delay revocation to avoid edge-case race conditions on some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function decodeAttachment(att: EmailAttachment): Uint8Array {
  if (att.encoding === "base64") {
    const binaryData = atob(att.data.replace(/\s/g, ""));
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    return bytes;
  }

  return TEXT_ENCODER.encode(att.data);
}

function getBodyAsHtml(message: EmailMessage): string {
  if (message.htmlBody) {
    return sanitizeHtmlBodyForExport(message.htmlBody);
  }

  const escaped = escapeHtml(message.body);

  return `<pre>${escaped}</pre>`;
}

function getBodyAsText(message: EmailMessage): string {
  if (message.body?.trim()) {
    return message.body;
  }

  if (!message.htmlBody) {
    return "";
  }

  const sanitizedHtml = sanitizeHtmlBodyForExport(message.htmlBody);
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizedHtml, "text/html");
  const content = doc.body?.textContent || "";
  return content.trim();
}

function buildTextExport(
  messages: Array<{ index: number; message: EmailMessage }>,
  localization: ExportLocalization
) {
  void localization;
  return messages.map(({ message }) => getBodyAsText(message)).join("\n\n");
}

function buildHtmlExport(
  messages: Array<{ index: number; message: EmailMessage }>,
  localization: ExportLocalization
) {
  void localization;
  return messages.map(({ message }) => getBodyAsHtml(message)).join("\n\n");
}

function getPerMessageExportFilename(
  message: EmailMessage,
  messagePosition: number,
  extension: "txt" | "html",
  usedNames: Set<string>
): string {
  const baseFilename = `${getAttachmentFolderName(message, messagePosition)}.${extension}`;
  const fallbackFilename = `message-${String(messagePosition + 1).padStart(4, "0")}.${extension}`;

  return ensureUniqueFilename(baseFilename, usedNames, fallbackFilename);
}

async function buildMboxExport(
  file: MailFile,
  selectedIndices: number[],
  onMessageProcessed?: (processedCount: number, totalCount: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!file.fileReader || !file.messageBoundaries) {
    throw new Error("EXPORT_FILE_UNAVAILABLE");
  }

  const chunks: string[] = [];

  for (let i = 0; i < selectedIndices.length; i++) {
    if (signal?.aborted) {
      throw new Error("EXPORT_ABORTED");
    }

    const index = selectedIndices[i];
    const boundary = file.messageBoundaries[index];
    if (!boundary) {
      continue;
    }

    const rawMessage = await file.fileReader.readBytesAsText(
      boundary.start,
      boundary.end
    );
    chunks.push(rawMessage.endsWith("\n") ? rawMessage : `${rawMessage}\n`);
    onMessageProcessed?.(i + 1, selectedIndices.length);
  }

  return chunks.join("");
}

function getMainFileExtension(format: ExportFormat): string {
  if (format === "mbox") {
    return "mbox";
  }
  if (format === "html") {
    return "html";
  }
  return "txt";
}

function getExportMimeType(format: ExportFormat): string {
  if (format === "html") {
    return "text/html;charset=utf-8";
  }
  if (format === "mbox") {
    return "application/mbox;charset=utf-8";
  }
  return "text/plain;charset=utf-8";
}

function getAttachmentFolderName(
  message: EmailMessage,
  fallbackIndex: number
): string {
  const subject = sanitizeFilenamePart(message.subject || "no-subject");
  return `message-${String(fallbackIndex + 1).padStart(4, "0")}-${subject || "no-subject"}`;
}

function ensureUniqueFilename(
  baseName: string,
  usedNames: Set<string>,
  fallbackName: string
): string {
  const normalized = baseName || fallbackName;
  const normalizedUsedNames = new Set(
    Array.from(usedNames).map((name) => name.toLowerCase())
  );
  const normalizedLowercase = normalized.toLowerCase();

  if (!normalizedUsedNames.has(normalizedLowercase)) {
    usedNames.add(normalized);
    return normalized;
  }

  const dotIndex = normalized.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < normalized.length - 1;
  const fileStem = hasExtension ? normalized.slice(0, dotIndex) : normalized;
  const fileExtension = hasExtension ? normalized.slice(dotIndex) : "";

  let counter = 2;
  let candidate = `${fileStem}-${counter}${fileExtension}`;
  while (normalizedUsedNames.has(candidate.toLowerCase())) {
    counter++;
    candidate = `${fileStem}-${counter}${fileExtension}`;
  }

  usedNames.add(candidate);
  return candidate;
}

export async function exportMessages({
  file,
  selectedIndices,
  format,
  includeAttachments,
  localization,
  onProgress,
  signal,
  loadMessage,
}: ExportMessagesOptions): Promise<void> {
  let currentProgress = 0;
  const reportProgress = (value: number) => {
    const normalized = Math.max(0, Math.min(100, value));
    currentProgress = Math.max(currentProgress, normalized);
    onProgress?.(currentProgress);
  };
  const ensureNotAborted = () => {
    if (signal?.aborted) {
      throw new Error("EXPORT_ABORTED");
    }
  };

  const sortedUniqueIndices = Array.from(new Set(selectedIndices)).sort(
    (a, b) => a - b
  );

  if (sortedUniqueIndices.length === 0) {
    throw new Error("EXPORT_NO_SELECTION");
  }

  const shouldExportPerMessageFiles =
    format !== "mbox" && (includeAttachments || sortedUniqueIndices.length > 1);

  reportProgress(0);
  ensureNotAborted();

  const filenameBase = getFilenameBase(file.name, sortedUniqueIndices.length);
  const extension = getMainFileExtension(format);
  const mainFilename = `${filenameBase}.${extension}`;

  let mainContent = "";
  let parsedMessages: Array<{ index: number; message: EmailMessage }> = [];

  if (format === "mbox") {
    mainContent = await buildMboxExport(
      file,
      sortedUniqueIndices,
      (processedCount, totalCount) => {
        const maxProgressForStage = includeAttachments ? 60 : 100;
        const progress = Math.round(
          (processedCount / totalCount) * maxProgressForStage
        );
        reportProgress(progress);
      },
      signal
    );
  }

  if (format === "txt" || format === "html" || includeAttachments) {
    parsedMessages = [];
    for (let i = 0; i < sortedUniqueIndices.length; i++) {
      ensureNotAborted();
      const index = sortedUniqueIndices[i];
      const message = await loadMessage(file.id, index);
      parsedMessages.push({ index, message });

      if (format !== "mbox" || includeAttachments) {
        const stageStart = format === "mbox" ? 60 : 0;
        const stageSpan =
          format === "mbox"
            ? 30
            : shouldExportPerMessageFiles
              ? includeAttachments
                ? 70
                : 85
              : 100;
        const progress =
          stageStart +
          Math.round(((i + 1) / sortedUniqueIndices.length) * stageSpan);
        reportProgress(progress);
      }
    }
  }

  ensureNotAborted();

  if (format === "txt") {
    if (parsedMessages.length === 1) {
      mainContent = buildTextExport(parsedMessages, localization);
    }
  } else if (format === "html") {
    if (parsedMessages.length === 1) {
      mainContent = buildHtmlExport(parsedMessages, localization);
    }
  }

  if (!shouldExportPerMessageFiles && !includeAttachments) {
    downloadBlob(
      new Blob([mainContent], {
        type: getExportMimeType(format),
      }),
      mainFilename
    );
    reportProgress(100);
    return;
  }

  const zip = new JSZip();

  if (format === "mbox") {
    zip.file(mainFilename, mainContent);
  } else {
    const perMessageExtension = format === "html" ? "html" : "txt";
    const usedFileNames = new Set<string>();
    for (let i = 0; i < parsedMessages.length; i++) {
      const entry = parsedMessages[i];
      const filename = getPerMessageExportFilename(
        entry.message,
        i,
        perMessageExtension,
        usedFileNames
      );
      const content =
        format === "html"
          ? buildHtmlExport([entry], localization)
          : buildTextExport([entry], localization);
      zip.file(filename, content);
    }
  }

  if (includeAttachments) {
    for (let i = 0; i < parsedMessages.length; i++) {
      ensureNotAborted();
      const { message } = parsedMessages[i];
      const attachments = message.attachments || [];

      if (attachments.length > 0) {
        const folderName = getAttachmentFolderName(message, i);
        const folder = zip.folder(`attachments/${folderName}`);
        const usedAttachmentNames = new Set<string>();

        for (let j = 0; j < attachments.length; j++) {
          const att = attachments[j];
          const sanitizedFilename =
            sanitizeFilenamePart(att.filename || `attachment-${j + 1}`) ||
            `attachment-${j + 1}`;
          const filename = ensureUniqueFilename(
            sanitizedFilename,
            usedAttachmentNames,
            `attachment-${j + 1}`
          );
          folder?.file(filename, decodeAttachment(att));
        }
      }

      const stageStart = format === "mbox" ? 90 : 80;
      const stageSpan = format === "mbox" ? 5 : 15;
      const progress =
        stageStart + Math.round(((i + 1) / parsedMessages.length) * stageSpan);
      reportProgress(progress);
    }
  }

  ensureNotAborted();
  let abortedDuringZipGeneration = false;
  const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
    if (signal?.aborted) {
      abortedDuringZipGeneration = true;
      return;
    }

    const zipProgress = 95 + Math.round(metadata.percent / 20);
    reportProgress(zipProgress);
  });

  if (abortedDuringZipGeneration) {
    throw new Error("EXPORT_ABORTED");
  }

  ensureNotAborted();
  downloadBlob(zipBlob, `${filenameBase}.zip`);
  reportProgress(100);
}
