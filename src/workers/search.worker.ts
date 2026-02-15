/// <reference lib="webworker" />

interface MessageBoundary {
  index: number;
  start: number;
  end: number;
  preview?: {
    from?: string;
    to?: string;
    subject?: string;
    date?: string;
    labels?: string[];
  };
}

interface SearchPayload {
  file: File;
  boundaries: MessageBoundary[];
  query: string;
}

type WorkerMessage =
  | { type: "SEARCH"; payload: SearchPayload }
  | { type: "ABORT" };

interface ParsedSearchQuery {
  textTerms: string[];
  fromTerms: string[];
  toTerms: string[];
  subjectTerms: string[];
  labelTerms: string[];
  beforeTimestamps: number[];
  afterTimestamps: number[];
  requireAttachment: boolean;
}

function tokenizeQuery(query: string): string[] {
  const tokens: string[] = [];
  const tokenRegex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null = null;

  while ((match = tokenRegex.exec(query)) !== null) {
    const token = (match[1] || match[2] || "").trim();
    if (token) {
      tokens.push(token);
    }
  }

  return tokens;
}

function parseQueryDate(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function parseSearchQuery(query: string): ParsedSearchQuery {
  const parsed: ParsedSearchQuery = {
    textTerms: [],
    fromTerms: [],
    toTerms: [],
    subjectTerms: [],
    labelTerms: [],
    beforeTimestamps: [],
    afterTimestamps: [],
    requireAttachment: false,
  };

  const tokens = tokenizeQuery(query);
  for (const token of tokens) {
    const separatorIdx = token.indexOf(":");
    if (separatorIdx <= 0 || separatorIdx === token.length - 1) {
      parsed.textTerms.push(token.toLowerCase());
      continue;
    }

    const key = token.slice(0, separatorIdx).toLowerCase();
    const value = token.slice(separatorIdx + 1).trim();
    const normalizedValue = value.toLowerCase();
    if (!normalizedValue) {
      parsed.textTerms.push(token.toLowerCase());
      continue;
    }

    if (key === "from") {
      parsed.fromTerms.push(normalizedValue);
      continue;
    }

    if (key === "to") {
      parsed.toTerms.push(normalizedValue);
      continue;
    }

    if (key === "subject") {
      parsed.subjectTerms.push(normalizedValue);
      continue;
    }

    if (key === "label") {
      parsed.labelTerms.push(normalizedValue);
      continue;
    }

    if (key === "before") {
      const timestamp = parseQueryDate(value);
      if (timestamp !== null) {
        parsed.beforeTimestamps.push(timestamp);
        continue;
      }
    }

    if (key === "after") {
      const timestamp = parseQueryDate(value);
      if (timestamp !== null) {
        parsed.afterTimestamps.push(timestamp);
        continue;
      }
    }

    if (
      key === "has" &&
      (normalizedValue === "attachment" || normalizedValue === "attachments")
    ) {
      parsed.requireAttachment = true;
      continue;
    }

    parsed.textTerms.push(token.toLowerCase());
  }

  return parsed;
}

function matchesStructuredQuery(
  parsedQuery: ParsedSearchQuery,
  boundary: MessageBoundary
): boolean {
  const previewFrom = boundary.preview?.from?.toLowerCase() || "";
  const previewTo = boundary.preview?.to?.toLowerCase() || "";
  const previewSubject = boundary.preview?.subject?.toLowerCase() || "";
  const previewLabels = (boundary.preview?.labels || []).map((label) =>
    label.toLowerCase()
  );
  const previewDateMs = boundary.preview?.date
    ? Date.parse(boundary.preview.date)
    : Number.NaN;

  if (
    parsedQuery.fromTerms.some((term) => !previewFrom.includes(term)) ||
    parsedQuery.toTerms.some((term) => !previewTo.includes(term)) ||
    parsedQuery.subjectTerms.some((term) => !previewSubject.includes(term))
  ) {
    return false;
  }

  if (
    parsedQuery.labelTerms.some(
      (term) => !previewLabels.some((label) => label.includes(term))
    )
  ) {
    return false;
  }

  if (
    parsedQuery.beforeTimestamps.length > 0 ||
    parsedQuery.afterTimestamps.length > 0
  ) {
    if (Number.isNaN(previewDateMs)) {
      return false;
    }

    if (
      parsedQuery.beforeTimestamps.some(
        (timestamp) => previewDateMs >= timestamp
      )
    ) {
      return false;
    }

    if (
      parsedQuery.afterTimestamps.some(
        (timestamp) => previewDateMs <= timestamp
      )
    ) {
      return false;
    }
  }

  return true;
}

// Simple ByteReader clone for the worker
class WorkerByteReader {
  constructor(private file: File) {}

  readBytesAsText(start: number, end: number): Promise<string> {
    const blob = this.file.slice(start, end);
    return blob.text();
  }
}

let activeSearchRunId = 0;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  if (type === "ABORT") {
    activeSearchRunId += 1;
    return;
  }

  if (type === "SEARCH") {
    const runId = ++activeSearchRunId;
    const { payload } = event.data;
    const { file, boundaries, query } = payload;

    if (!file || !boundaries || !query) {
      self.postMessage({ type: "ERROR", payload: "Invalid payload" });
      return;
    }

    const reader = new WorkerByteReader(file);
    const parsedQuery = parseSearchQuery(query);
    const hasTextTerms = parsedQuery.textTerms.length > 0;
    const requiresContentCheck = hasTextTerms || parsedQuery.requireAttachment;
    const matchingIndices: number[] = [];
    const progressInterval = Math.max(1, Math.floor(boundaries.length / 100));

    self.postMessage({ type: "PROGRESS", payload: 0 });

    try {
      for (let i = 0; i < boundaries.length; i++) {
        if (runId !== activeSearchRunId) {
          return;
        }

        const boundary = boundaries[i];
        if (matchesStructuredQuery(parsedQuery, boundary)) {
          let contentLower = "";
          if (requiresContentCheck) {
            const content = await reader.readBytesAsText(
              boundary.start,
              boundary.end
            );
            contentLower = content.toLowerCase();
          }

          const hasRequiredAttachment = parsedQuery.requireAttachment
            ? contentLower.includes("content-disposition: attachment") ||
              /filename\s*=/.test(contentLower)
            : true;
          const hasRequiredTextTerms = parsedQuery.textTerms.every((term) =>
            contentLower.includes(term)
          );

          if (hasRequiredAttachment && hasRequiredTextTerms) {
            // Use absolute position in boundaries array so results stay aligned
            // with sorted/paginated message lists in the UI.
            matchingIndices.push(i);
          }
        }

        // Report progress at adaptive intervals for smooth feedback
        if ((i + 1) % progressInterval === 0 || i + 1 === boundaries.length) {
          const progress = Math.round(((i + 1) / boundaries.length) * 100);
          self.postMessage({ type: "PROGRESS", payload: progress });
        }
      }

      if (runId === activeSearchRunId) {
        self.postMessage({ type: "PROGRESS", payload: 100 });
        self.postMessage({ type: "RESULTS", payload: matchingIndices });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown worker error";
      self.postMessage({ type: "ERROR", payload: errorMessage });
    }
  }
};

// Export empty object to satisfy TypeScript's module requirement
export {};
