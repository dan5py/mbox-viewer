/**
 * MBOX Parser
 * Follows RFC 4155 for mbox format: "From address timestamp" separator
 *
 * CRITICAL: Messages must be read from complete boundary to boundary
 * Use scanMessageBoundaries() to find proper boundaries first!
 * Never read at arbitrary byte positions.
 */

import {
  Address,
  AddressOrGroup,
  ParsedMessage,
  parseMail,
} from "@protontech/jsmimeparser";

import { EmailAttachment, EmailMessage } from "~/types/files";

import { ByteReader } from "./byte-reader";

/**
 * RFC 4155 separator line format: "From address timestamp"
 * Extracts sender email and timestamp from the separator
 */
interface MboxSeparator {
  email: string;
  timestamp: string;
}

/**
 * Parse RFC 4155 mbox separator line
 * Format: "From <email> <timestamp>"
 * Example: "From sender@example.com Thu Jan  1 00:00:00 1970"
 */
function parseMboxSeparator(line: string): MboxSeparator | null {
  if (!line.startsWith("From ")) {
    return null;
  }

  // Remove "From " prefix
  const content = line.slice(5).trim();

  // Extract email (first word that looks like an email)
  const emailMatch = content.match(/^([^\s@]+@[^\s]+)\s+(.*)/);

  if (!emailMatch) {
    return null;
  }

  const email = emailMatch[1];
  const timestamp = emailMatch[2];

  return { email, timestamp };
}

/**
 * Convert a Uint8Array to base64 string
 * Uses chunked processing for large arrays
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  const chunkSize = 8192; // Process 8KB at a time
  const chunks: string[] = [];

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }

  return btoa(chunks.join(""));
}

/**
 * Convert jsmimeparser ParsedMessage to custom EmailMessage format
 */
function convertParsedMessage(
  parsed: ParsedMessage,
  messageIndex: number,
  fromEnvelope?: string
): EmailMessage {
  // Extract sender email address
  let from = "Unknown";
  if (parsed.from) {
    from = parsed.from.email
      ? `${parsed.from.name || ""}${parsed.from.name ? " " : ""}<${
          parsed.from.email
        }>`.trim()
      : parsed.from.name || "Unknown";
  } else if (fromEnvelope) {
    from = fromEnvelope;
  }

  // Format recipient addresses
  const formatAddressArray = (
    addresses:
      | Array<
          | { name: string; email: string }
          | { name: string; group: Array<{ name: string; email: string }> }
        >
      | undefined
  ): string => {
    if (!addresses || addresses.length === 0) return "";

    return addresses
      .map((addr: AddressOrGroup) => {
        if ("group" in addr) {
          // Group address
          return addr.group
            .map((a: Address) =>
              `${a.name || ""}${a.name ? " " : ""}<${a.email}>`.trim()
            )
            .join(", ");
        } else {
          // Single address
          return `${addr.name || ""}${addr.name ? " " : ""}<${
            addr.email
          }>`.trim();
        }
      })
      .join(", ");
  };

  const to = formatAddressArray(parsed.to);
  const cc = formatAddressArray(parsed.cc);
  const bcc = formatAddressArray(parsed.bcc);
  const subject = parsed.subject || "(No Subject)";

  const date = parsed.date || new Date();
  const rawDate = parsed.date?.toISOString() || new Date().toISOString();

  const body = parsed.body.text || "";
  const htmlBody = parsed.body.html || undefined;

  // Convert attachments from jsmimeparser format
  const attachments: EmailAttachment[] = parsed.attachments.map((att, idx) => {
    const base64Data = uint8ArrayToBase64(att.content);
    const contentIdHeader = att.headers["content-id"];
    const contentId = Array.isArray(contentIdHeader)
      ? contentIdHeader[0]
      : contentIdHeader;

    if (
      att.contentType === "application/octet-stream" &&
      att.fileName?.endsWith(".pdf")
    ) {
      att.contentType = "application/pdf";
    }

    return {
      id: `msg-${messageIndex}-att-${idx}`,
      filename: att.fileName || `attachment-${idx}`,
      mimeType: att.contentType || "application/octet-stream",
      size: att.size || att.content.length,
      encoding: "base64",
      data: base64Data,
      contentId: contentId ? contentId.replace(/[<>]/g, "") : undefined,
    };
  });

  // Collect all headers in lowercase
  const headers: Record<string, string> = {};
  for (const [key, values] of Object.entries(parsed.headers)) {
    headers[key.toLowerCase()] = Array.isArray(values)
      ? values.join(", ")
      : values;
  }

  return {
    id: `msg-${messageIndex}`,
    from,
    to,
    cc,
    bcc,
    subject,
    date,
    rawDate,
    body,
    htmlBody,
    headers,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/**
 * Parse a single email message from raw text (including optional mbox separator)
 *
 * IMPORTANT: The rawEmail MUST be a complete message:
 * - Starts with the "From " separator line (RFC 4155)
 * - Ends just before the next message's "From " line (or EOF)
 * - Never split in the middle of headers or MIME boundaries
 *
 * Use scanMessageBoundaries() to find proper start/end positions!
 */
export function parseEmailFromText(
  rawEmail: string,
  messageIndex: number
): EmailMessage {
  // Handle empty input
  if (!rawEmail || !rawEmail.trim()) {
    return {
      id: `msg-${messageIndex}`,
      from: "Unknown",
      to: "",
      subject: "(Empty Message)",
      date: new Date(),
      rawDate: new Date().toISOString(),
      body: "",
      headers: {},
    };
  }

  const lines = rawEmail.split(/\r?\n/);
  let startIdx = 0;
  let fromEnvelope: string | undefined;

  // Check for RFC 4155 mbox separator (From line) at position 0
  if (lines[0]?.startsWith("From ")) {
    const separator = parseMboxSeparator(lines[0]);
    if (separator) {
      fromEnvelope = separator.email;
      startIdx = 1; // Skip separator line, parse headers + body
    }
  }

  // Join remaining lines, removing the trailing empty line that marks message end
  let emailContent = lines.slice(startIdx).join("\n");

  // Remove trailing empty lines/newlines (message terminator per RFC 4155)
  emailContent = emailContent.trim();

  if (!emailContent) {
    return {
      id: `msg-${messageIndex}`,
      from: fromEnvelope || "Unknown",
      to: "",
      subject: "(Empty Message)",
      date: new Date(),
      rawDate: new Date().toISOString(),
      body: "",
      headers: {},
    };
  }

  try {
    const parsed = parseMail(emailContent);

    // Convert to our format, using envelope "From" if message doesn't have From header
    return convertParsedMessage(parsed, messageIndex, fromEnvelope);
  } catch (error) {
    console.error("Failed to parse email:", error);

    // Fallback: return basic message structure
    return {
      id: `msg-${messageIndex}`,
      from: fromEnvelope || "Unknown",
      to: "",
      subject: "(Parse Error)",
      date: new Date(),
      rawDate: new Date().toISOString(),
      body: emailContent.substring(0, 500),
      headers: {},
    };
  }
}

/**
 * Load a complete message from byte range
 *
 * IMPORTANT: The byte range MUST be from one "From " separator to the next
 * (or end of file). Use scanMessageBoundaries() to get proper boundaries!
 *
 * This ensures we never:
 * - Start reading in the middle of headers
 * - Cut MIME boundaries
 * - Split base64-encoded attachment data
 */
export async function loadMessageFromRange(
  reader: ByteReader,
  start: number,
  end: number,
  messageIndex: number
): Promise<EmailMessage> {
  try {
    // Read the complete message as text
    const rawText = await reader.readBytesAsText(start, end);
    return parseEmailFromText(rawText, messageIndex);
  } catch (error) {
    console.error(
      `Failed to load message ${messageIndex} from bytes ${start}-${end}:`,
      error
    );

    // Return fallback message on critical error
    return {
      id: `msg-${messageIndex}`,
      from: "Unknown",
      to: "",
      subject: "(Load Error)",
      date: new Date(),
      rawDate: new Date().toISOString(),
      body: `Error loading message from byte offset ${start}`,
      headers: {},
    };
  }
}

/**
 * Load message from buffer (binary-safe version)
 *
 * Same requirements as loadMessageFromRange:
 * Byte range must be from boundary to boundary!
 */
export async function loadMessageFromRangeBuffer(
  reader: ByteReader,
  start: number,
  end: number,
  messageIndex: number
): Promise<EmailMessage> {
  try {
    const buffer = await reader.readBytesAsBuffer(start, end);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return parseEmailFromText(text, messageIndex);
  } catch (error) {
    console.error(
      `Failed to load message ${messageIndex} from buffer ${start}-${end}:`,
      error
    );

    return {
      id: `msg-${messageIndex}`,
      from: "Unknown",
      to: "",
      subject: "(Buffer Load Error)",
      date: new Date(),
      rawDate: new Date().toISOString(),
      body: `Error loading message from buffer offset ${start}`,
      headers: {},
    };
  }
}
