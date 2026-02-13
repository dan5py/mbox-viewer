import JSZip from "jszip";

import { EmailAttachment, EmailMessage, MailFile } from "~/types/files";

export type ExportFormat = "html" | "mbox" | "txt";

interface ExportMessagesOptions {
  file: MailFile;
  selectedIndices: number[];
  format: ExportFormat;
  includeAttachments: boolean;
  loadMessage: (fileId: string, messageIndex: number) => Promise<EmailMessage>;
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
  const timestamp = EXPORT_FILENAME_DATE_FORMATTER.format(new Date())
    .replace(/\s+/g, "_")
    .replace(/:/g, "-");

  return `${sanitizeFilenamePart(baseName)}-${selectedCount}messages-${timestamp}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
    return message.htmlBody;
  }

  const escaped = message.body
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return `<pre>${escaped}</pre>`;
}

function buildTextExport(
  messages: Array<{ index: number; message: EmailMessage }>
) {
  return messages
    .map(({ index, message }, i) => {
      return [
        "--------------------------------------------------------------------------------",
        `Message ${i + 1} (index: ${index + 1})`,
        "--------------------------------------------------------------------------------",
        `From: ${message.from || ""}`,
        `To: ${message.to || ""}`,
        `Cc: ${message.cc || ""}`,
        `Bcc: ${message.bcc || ""}`,
        `Date: ${message.rawDate || message.date.toISOString()}`,
        `Subject: ${message.subject || ""}`,
        "",
        message.body || "",
        "",
      ].join("\n");
    })
    .join("\n");
}

function buildHtmlExport(
  messages: Array<{ index: number; message: EmailMessage }>
) {
  const sections = messages
    .map(({ index, message }, i) => {
      return `
        <section class="message">
          <h2>Message ${i + 1} (index: ${index + 1})</h2>
          <div class="meta">
            <div><strong>From:</strong> ${message.from || ""}</div>
            <div><strong>To:</strong> ${message.to || ""}</div>
            <div><strong>Cc:</strong> ${message.cc || ""}</div>
            <div><strong>Bcc:</strong> ${message.bcc || ""}</div>
            <div><strong>Date:</strong> ${message.rawDate || message.date.toISOString()}</div>
            <div><strong>Subject:</strong> ${message.subject || ""}</div>
          </div>
          <hr />
          <div class="content">
            ${getBodyAsHtml(message)}
          </div>
        </section>
      `;
    })
    .join("\n");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>MBOX Export</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; padding: 24px; max-width: 1200px; margin: 0 auto; }
          .message { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
          .meta { display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 14px; margin-bottom: 16px; }
          .content { background: #f9fafb; border-radius: 6px; padding: 12px; overflow-x: auto; }
          pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
          hr { border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0; }
        </style>
      </head>
      <body>
        <h1>MBOX Export</h1>
        <p>Exported ${messages.length} messages</p>
        ${sections}
      </body>
    </html>
  `.trim();
}

async function buildMboxExport(
  file: MailFile,
  selectedIndices: number[]
): Promise<string> {
  if (!file.fileReader || !file.messageBoundaries) {
    throw new Error(
      "Missing file reader or message boundaries for mbox export."
    );
  }

  const chunks: string[] = [];

  for (const index of selectedIndices) {
    const boundary = file.messageBoundaries[index];
    if (!boundary) {
      continue;
    }

    const rawMessage = await file.fileReader.readBytesAsText(
      boundary.start,
      boundary.end
    );
    chunks.push(rawMessage.endsWith("\n") ? rawMessage : `${rawMessage}\n`);
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

function getAttachmentFolderName(
  message: EmailMessage,
  fallbackIndex: number
): string {
  const subject = sanitizeFilenamePart(message.subject || "no-subject");
  return `message-${String(fallbackIndex + 1).padStart(4, "0")}-${subject || "no-subject"}`;
}

export async function exportMessages({
  file,
  selectedIndices,
  format,
  includeAttachments,
  loadMessage,
}: ExportMessagesOptions): Promise<void> {
  const sortedUniqueIndices = Array.from(new Set(selectedIndices)).sort(
    (a, b) => a - b
  );

  if (sortedUniqueIndices.length === 0) {
    throw new Error("No messages selected for export.");
  }

  const filenameBase = getFilenameBase(file.name, sortedUniqueIndices.length);
  const extension = getMainFileExtension(format);
  const mainFilename = `${filenameBase}.${extension}`;

  let mainContent = "";
  let parsedMessages: Array<{ index: number; message: EmailMessage }> = [];

  if (format === "mbox") {
    mainContent = await buildMboxExport(file, sortedUniqueIndices);
  }

  if (format === "txt" || format === "html" || includeAttachments) {
    parsedMessages = await Promise.all(
      sortedUniqueIndices.map(async (index) => {
        const message = await loadMessage(file.id, index);
        return { index, message };
      })
    );
  }

  if (format === "txt") {
    mainContent = buildTextExport(parsedMessages);
  } else if (format === "html") {
    mainContent = buildHtmlExport(parsedMessages);
  }

  if (!includeAttachments) {
    downloadBlob(
      new Blob([mainContent], {
        type:
          format === "html"
            ? "text/html;charset=utf-8"
            : "text/plain;charset=utf-8",
      }),
      mainFilename
    );
    return;
  }

  const zip = new JSZip();
  zip.file(mainFilename, mainContent);

  for (let i = 0; i < parsedMessages.length; i++) {
    const { message } = parsedMessages[i];
    const attachments = message.attachments || [];

    if (attachments.length === 0) {
      continue;
    }

    const folderName = getAttachmentFolderName(message, i);
    const folder = zip.folder(`attachments/${folderName}`);

    for (let j = 0; j < attachments.length; j++) {
      const att = attachments[j];
      const filename =
        sanitizeFilenamePart(att.filename || `attachment-${j + 1}`) ||
        `attachment-${j + 1}`;
      folder?.file(filename, decodeAttachment(att));
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${filenameBase}.zip`);
}
