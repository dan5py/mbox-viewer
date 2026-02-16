/// <reference lib="webworker" />

import {
  evaluateSearch,
  isSimpleQuery,
  parseSearchQuery,
  type SearchContext,
  type SearchNode,
} from "~/lib/search-query";

interface MessageBoundary {
  index: number;
  start: number;
  end: number;
  preview?: {
    from: string;
    to: string;
    subject: string;
    date: string;
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

class WorkerByteReader {
  constructor(private file: File) {}

  readBytesAsText(start: number, end: number): Promise<string> {
    const blob = this.file.slice(start, end);
    return blob.text();
  }
}

let activeSearchRunId = 0;

/**
 * Check if a boundary preview indicates the message has attachments.
 * The worker doesn't have the full parsed message, so we check for
 * common attachment-related headers in the raw content when needed.
 */
function contentHasAttachmentIndicators(rawContent: string): boolean {
  const lower = rawContent.toLowerCase();
  return (
    lower.includes("content-disposition: attachment") ||
    lower.includes('content-disposition: inline; filename=') ||
    (lower.includes("content-type: multipart/mixed") &&
      lower.includes("boundary="))
  );
}

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
    const matchingIndices: number[] = [];
    const progressInterval = Math.max(1, Math.floor(boundaries.length / 100));

    self.postMessage({ type: "PROGRESS", payload: 0 });

    // Decide search strategy
    const simple = isSimpleQuery(query);

    let ast: SearchNode | null = null;
    if (!simple) {
      ast = parseSearchQuery(query);
      if (!ast) {
        self.postMessage({
          type: "ERROR",
          payload: "Invalid search query syntax",
        });
        return;
      }
    }

    const lowerCaseQuery = query.toLowerCase();

    try {
      for (let i = 0; i < boundaries.length; i++) {
        if (runId !== activeSearchRunId) return;

        const boundary = boundaries[i];
        const content = await reader.readBytesAsText(
          boundary.start,
          boundary.end
        );

        let matches: boolean;

        if (simple) {
          // Fast path: simple substring match across entire message
          matches = content.toLowerCase().includes(lowerCaseQuery);
        } else {
          // Advanced: build context and evaluate AST
          const preview = boundary.preview;
          const lowerContent = content.toLowerCase();

          const ctx: SearchContext = {
            from: (preview?.from || "").toLowerCase(),
            to: (preview?.to || "").toLowerCase(),
            subject: (preview?.subject || "").toLowerCase(),
            body: lowerContent,
            labels: (preview?.labels || []).map((l) => l.toLowerCase()),
            date: preview?.date ? new Date(preview.date).getTime() : 0,
            hasAttachment: contentHasAttachmentIndicators(content),
          };

          matches = evaluateSearch(ast!, ctx);
        }

        if (matches) {
          matchingIndices.push(i);
        }

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

export {};
