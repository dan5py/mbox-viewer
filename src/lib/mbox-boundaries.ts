/**
 * MBOX boundary scanner - finds message boundaries without loading entire file.
 * This implementation uses robust, line-by-line byte stream processing to
 * ensure accurate boundary detection, inspired by traditional mbox parsers.
 */

import { ByteReader } from "./byte-reader";
import {
  decodeMimeWords,
  getHeaderValue,
  parseHeaders,
  parseRfc2822Date,
} from "./header-parser";

export interface MessageBoundary {
  index: number; // Message index (0-based)
  start: number; // Starting byte offset
  end: number; // Ending byte offset
  preview?: {
    // Quick preview of message
    from: string;
    to: string;
    subject: string;
    date: string;
    size: number;
    labels?: string[]; // Email labels (e.g., from x-gmail-labels header)
  };
}

const CHUNK_SIZE = 512 * 1024; // 512KB chunks for scanning

/**
 * Extract quick header info from raw message start
 */
async function getMessagePreview(
  reader: ByteReader,
  start: number
): Promise<MessageBoundary["preview"] | undefined> {
  try {
    // Read first 8KB to get headers (increased for safety)
    const headerSize = Math.min(8192, reader.getSize() - start);
    const rawContent = await reader.readBytesAsText(start, start + headerSize);

    const headers = parseHeaders(rawContent);

    const fromRaw = getHeaderValue(headers, "from") || "";
    const toRaw = getHeaderValue(headers, "to") || "";
    const subjectRaw = getHeaderValue(headers, "subject") || "";
    const dateRaw = getHeaderValue(headers, "date") || "";

    const from = decodeMimeWords(fromRaw) || "Unknown";
    const to = decodeMimeWords(toRaw) || "";
    const subject = decodeMimeWords(subjectRaw) || "(No Subject)";

    const dateMs = dateRaw ? parseRfc2822Date(dateRaw) : undefined;
    const date = dateMs
      ? new Date(dateMs).toISOString()
      : new Date().toISOString();

    // Extract labels from common label headers
    const labels: string[] = [];
    const labelHeaders = [
      "x-gmail-labels",
      "x-labels",
      "keywords",
      "x-keywords",
    ];

    for (const headerName of labelHeaders) {
      const labelValue = getHeaderValue(headers, headerName);
      if (labelValue) {
        // Split by comma and clean up labels
        const extractedLabels = labelValue
          .split(",")
          .map((label) => label.trim())
          .filter((label) => label.length > 0);
        labels.push(...extractedLabels);
      }
    }

    return {
      from,
      to,
      subject,
      date,
      size: 0, // Will be set after we have end position
      labels: labels.length > 0 ? labels : undefined,
    };
  } catch (e) {
    console.warn("Failed to get message preview at byte", start, ":", e);
    // Return fallback instead of undefined
    return {
      from: "Unknown",
      to: "",
      subject: "(No Subject)",
      date: new Date().toISOString(),
      size: 0,
      labels: undefined,
    };
  }
}

/**
 * Scan MBOX file to find all message boundaries using line-by-line byte processing.
 * This is the most reliable method for mbox files.
 *
 * Process:
 * 1. Read file in chunks as raw byte buffers.
 * 2. Scan buffer for newline characters (`\n`) to identify line endings.
 * 3. For each complete line, check if the bytes match "From " at the start.
 * 4. Precisely track the absolute byte offset of each line's start.
 * 5. When a "From " line is found, it marks a message boundary.
 */
export async function scanMessageBoundaries(
  reader: ByteReader,
  {
    onProgress,
    onExtractPreview,
    signal,
  }: {
    onProgress?: (count: number, progress: number) => void;
    onExtractPreview?: () => void;
    signal?: AbortSignal;
  }
): Promise<MessageBoundary[]> {
  const fileSize = reader.getSize();
  const boundaries: MessageBoundary[] = [];
  let messageIndex = 0;

  let currentFilePos = 0;
  let buffer = new Uint8Array(0);
  let absoluteOffset = 0;

  const fromPattern = new Uint8Array([70, 114, 111, 109, 32]); // "From "

  while (currentFilePos < fileSize) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error("Scan cancelled");
    }

    const chunkEnd = Math.min(currentFilePos + CHUNK_SIZE, fileSize);
    const chunk = new Uint8Array(
      await reader.readBytesAsBuffer(currentFilePos, chunkEnd)
    );

    const newBuffer = new Uint8Array(buffer.length + chunk.length);
    newBuffer.set(buffer);
    newBuffer.set(chunk, buffer.length);
    buffer = newBuffer;

    let lineStartOffset = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x0a) {
        // Newline (LF)
        const line = buffer.subarray(lineStartOffset, i);
        const lineWithoutCR =
          line.length > 0 && line[line.length - 1] === 0x0d
            ? line.subarray(0, line.length - 1)
            : line;

        let isFromLine = false;
        if (lineWithoutCR.length >= fromPattern.length) {
          isFromLine = true;
          for (let j = 0; j < fromPattern.length; j++) {
            if (lineWithoutCR[j] !== fromPattern[j]) {
              isFromLine = false;
              break;
            }
          }
        }

        if (isFromLine) {
          const boundaryPos = absoluteOffset + lineStartOffset;
          if (boundaries.length > 0) {
            boundaries[boundaries.length - 1].end = boundaryPos;
          }
          boundaries.push({
            index: messageIndex++,
            start: boundaryPos,
            end: fileSize,
          });
        }

        lineStartOffset = i + 1;
      }
    }

    if (lineStartOffset > 0) {
      buffer = buffer.subarray(lineStartOffset);
      absoluteOffset += lineStartOffset;
    }

    currentFilePos = chunkEnd;

    if (onProgress) {
      onProgress(messageIndex, (currentFilePos / fileSize) * 100);
    }
  }

  // If the file is not empty but no "From " lines were found, treat it as a single message.
  if (fileSize > 0 && boundaries.length === 0) {
    boundaries.push({ index: 0, start: 0, end: fileSize });
  }

  onExtractPreview?.();

  // Extract previews for all messages
  for (let i = 0; i < boundaries.length; i++) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error("Scan cancelled");
    }

    const boundary = boundaries[i];
    const preview = await getMessagePreview(reader, boundary.start);
    if (preview) {
      preview.size = boundary.end - boundary.start;
      boundary.preview = preview;
    }
    if ((i + 1) % 50 === 0 && onProgress) {
      onProgress(boundaries.length, 100); // Indicate preview progress
    }
  }

  return boundaries;
}

/**
 * Quick scan to just count messages without storing boundaries.
 * Uses the same reliable line-by-line processing.
 */
export async function countMessages(reader: ByteReader): Promise<number> {
  const fileSize = reader.getSize();
  let currentPos = 0;
  let count = 0;
  let buffer = new Uint8Array(0);

  const fromPattern = new Uint8Array([70, 114, 111, 109, 32]); // "From "

  while (currentPos < fileSize) {
    const chunkEnd = Math.min(currentPos + CHUNK_SIZE, fileSize);
    const chunk = new Uint8Array(
      await reader.readBytesAsBuffer(currentPos, chunkEnd)
    );

    const newBuffer = new Uint8Array(buffer.length + chunk.length);
    newBuffer.set(buffer);
    newBuffer.set(chunk, buffer.length);
    buffer = newBuffer;

    let lineStartOffset = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x0a) {
        // Newline (LF)
        const line = buffer.subarray(lineStartOffset, i);
        const lineWithoutCR =
          line.length > 0 && line[line.length - 1] === 0x0d
            ? line.subarray(0, line.length - 1)
            : line;

        let isFromLine = false;
        if (lineWithoutCR.length >= fromPattern.length) {
          isFromLine = true;
          for (let j = 0; j < fromPattern.length; j++) {
            if (lineWithoutCR[j] !== fromPattern[j]) {
              isFromLine = false;
              break;
            }
          }
        }

        if (isFromLine) {
          count++;
        }

        lineStartOffset = i + 1;
      }
    }

    buffer = buffer.subarray(lineStartOffset);
    currentPos = chunkEnd;
  }

  if (fileSize > 0 && count === 0) {
    return 1;
  }

  return count;
}
