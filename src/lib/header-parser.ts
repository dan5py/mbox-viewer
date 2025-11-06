export interface ParsedHeaders {
  [key: string]: string[];
}

/**
 * Parse email headers from raw text
 * Handles folding whitespace and multiple headers with same name
 */
export function parseHeaders(emailOrHeaders: string): ParsedHeaders {
  // Trim and remove everything after double newline
  const headersStr = emailOrHeaders
    .trim()
    .replace(/\r?\n\r?\n[^]*$/g, "")
    .trim();

  const rawHeaders: string[] = [];
  const lines = headersStr.split(/\r?\n|\r/);

  // Undo folding whitespace (RFC 2822)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Folding whitespace - continuation line
    if (rawHeaders.length && line.match(/^\s/)) {
      rawHeaders[rawHeaders.length - 1] += line;
    } else if (line.indexOf(":") < 0) {
      // Line without colon - might be malformed
      if (!rawHeaders.length) {
        // Skip if it's the first line (probably "From " envelope)
        continue;
      }
      // Could be continuation without proper whitespace
      // For now, skip it
      console.warn("Skipping line without colon:", line.substring(0, 50));
    } else {
      // Normal header line
      rawHeaders.push(line);
    }
  }

  // Parse into object
  const headersObj: ParsedHeaders = {};

  for (const headerStr of rawHeaders) {
    const header = parseHeader(headerStr);
    if (header.key) {
      if (!headersObj[header.key]) {
        headersObj[header.key] = [header.value];
      } else {
        headersObj[header.key].push(header.value);
      }
    }
  }

  return headersObj;
}

/**
 * Parse single header line into kv pair
 */
function parseHeader(line: string): { key: string; value: string } {
  const match = line.match(/^\s*([^:]+):(.*)$/);
  const key = (match?.[1] ?? "").trim().toLowerCase();
  const value = (match?.[2] ?? "").trimStart();

  return {
    key,
    value,
  };
}

/**
 * Decode RFC 2047 MIME encoded-words
 */
export function decodeMimeWords(str: string): string {
  if (!str) return "";

  // Handle multiple encoded words that can be joined
  const joined = str.replace(
    /(=\?([^?]+)\?[BbQq]\?[^?]*\?=)\s*(?==\?([^?]+)\?[BbQq]\?[^?]*\?=)/g,
    (match, left, chLeft, chRight) => {
      // Only join if charsets match
      if (chLeft?.toLowerCase().trim() === chRight?.toLowerCase().trim()) {
        return left + "__JOIN__";
      }
      return match;
    }
  );

  // Remove join markers
  const cleaned = joined.replace(
    /(=\?([^?]+)\?[BbQq]\?[^?]*\?=)__JOIN__/g,
    "$1"
  );

  // Decode each encoded word
  return cleaned.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (match: string, charset: string, encoding: string, encoded: string) => {
      try {
        let decodedBytes: Uint8Array;

        if (encoding.toLowerCase() === "b") {
          // Base64
          // Handle concatenated base64 with = padding
          const parts = encoded.split("=");
          const buffers: Uint8Array[] = [];
          for (const part of parts) {
            if (part) {
              try {
                const binaryString = atob(part);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                buffers.push(bytes);
              } catch {
                // Skip invalid parts
              }
            }
          }
          // Combine all buffers
          const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
          decodedBytes = new Uint8Array(totalLength);
          let offset = 0;
          for (const buf of buffers) {
            decodedBytes.set(buf, offset);
            offset += buf.length;
          }
        } else {
          // Quoted-Printable
          // Convert underscores to spaces
          let qpStr = encoded.replace(/_/g, " ");
          // Remove spaces between = and hex
          qpStr = qpStr.replace(/=\s+([0-9a-fA-F])/g, "=$1");
          // Decode to bytes
          const bytes: number[] = [];
          let i = 0;
          while (i < qpStr.length) {
            if (qpStr[i] === "=" && i + 2 < qpStr.length) {
              const hex = qpStr.substring(i + 1, i + 3);
              if (/^[0-9A-F]{2}$/i.test(hex)) {
                bytes.push(parseInt(hex, 16));
                i += 3;
                continue;
              }
            }
            // Handle soft line breaks
            if (
              qpStr[i] === "=" &&
              (qpStr[i + 1] === "\r" || qpStr[i + 1] === "\n")
            ) {
              if (qpStr[i + 1] === "\r" && qpStr[i + 2] === "\n") {
                i += 3;
              } else {
                i += 2;
              }
              continue;
            }
            bytes.push(qpStr.charCodeAt(i));
            i++;
          }
          decodedBytes = new Uint8Array(bytes);
        }

        // Convert bytes according to charset
        const charsetLower = charset.toLowerCase().trim();
        let decoded: string;

        // Handle common charset aliases
        const normalizedCharset =
          charsetLower === "utf-8" || charsetLower === "utf8"
            ? "utf-8"
            : charsetLower === "iso-8859-1" ||
                charsetLower === "latin1" ||
                charsetLower === "latin-1"
              ? "iso-8859-1"
              : charsetLower === "windows-1252" || charsetLower === "cp1252"
                ? "windows-1252"
                : charsetLower;

        try {
          // Try using TextDecoder with the charset
          const decoder = new TextDecoder(normalizedCharset, {
            fatal: false,
            ignoreBOM: true,
          });
          decoded = decoder.decode(decodedBytes);
        } catch {
          // Fallback: try UTF-8, then Latin-1
          try {
            decoded = new TextDecoder("utf-8", { fatal: false }).decode(
              decodedBytes
            );
          } catch {
            decoded = new TextDecoder("iso-8859-1", { fatal: false }).decode(
              decodedBytes
            );
          }
        }

        return decoded;
      } catch (e) {
        console.warn("Failed to decode MIME word:", match, e);
        return match;
      }
    }
  );
}

/**
 * Get first value for a header (case-insensitive)
 */
export function getHeaderValue(
  headers: ParsedHeaders,
  name: string
): string | undefined {
  const nameLower = name.toLowerCase();
  const values = headers[nameLower];
  return values && values.length > 0 ? values[0] : undefined;
}

/**
 * Parse RFC 2822 date to Unix timestamp (ms)
 */
export function parseRfc2822Date(dateStr: string): number | undefined {
  if (!dateStr) return undefined;

  // Try JavaScript Date first
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  } catch {}

  // Manual parsing for RFC 2822: "Mon, 15 Jan 2024 10:30:00 +0000"
  const match = dateStr.match(
    /(\d{1,2})\s+(\w+)\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|[A-Z]{3,4})?/
  );

  if (match) {
    const [, day, month, year, hour, min, sec, tz] = match;

    const monthMap: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    const monthNum = monthMap[month.toLowerCase().substring(0, 3)];
    if (monthNum !== undefined) {
      const yearNum = parseInt(year);
      const fullYear =
        yearNum < 100
          ? yearNum < 50
            ? 2000 + yearNum
            : 1900 + yearNum
          : yearNum;

      const date = new Date(
        fullYear,
        monthNum,
        parseInt(day),
        parseInt(hour),
        parseInt(min),
        parseInt(sec || "0")
      );

      // Handle timezone offset if present
      if (tz && tz.match(/[+-]\d{4}/)) {
        const sign = tz[0] === "+" ? 1 : -1;
        const hours = parseInt(tz.substring(1, 3));
        const mins = parseInt(tz.substring(3, 5));
        const offsetMs = sign * (hours * 60 + mins) * 60 * 1000;
        return date.getTime() - offsetMs;
      }

      return date.getTime();
    }
  }

  return undefined;
}
