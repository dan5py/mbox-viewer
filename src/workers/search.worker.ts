/// <reference lib="webworker" />

interface MessageBoundary {
  index: number;
  start: number;
  end: number;
}

interface SearchPayload {
  file: File;
  boundaries: MessageBoundary[];
  query: string;
}

interface WorkerMessage {
  type: "SEARCH" | "ABORT";
  payload: SearchPayload;
}

// Simple ByteReader clone for the worker
class WorkerByteReader {
  constructor(private file: File) {}

  readBytesAsText(start: number, end: number): Promise<string> {
    const blob = this.file.slice(start, end);
    return blob.text();
  }
}

let isAborted = false;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === "ABORT") {
    isAborted = true;
    return;
  }

  if (type === "SEARCH") {
    isAborted = false;
    const { file, boundaries, query } = payload;

    if (!file || !boundaries || !query) {
      self.postMessage({ type: "ERROR", payload: "Invalid payload" });
      return;
    }

    const reader = new WorkerByteReader(file);
    const lowerCaseQuery = query.toLowerCase();
    const matchingIndices: number[] = [];
    const progressInterval = Math.max(1, Math.floor(boundaries.length / 100));

    self.postMessage({ type: "PROGRESS", payload: 0 });

    try {
      for (let i = 0; i < boundaries.length; i++) {
        if (isAborted) {
          return;
        }

        const boundary = boundaries[i];
        const content = await reader.readBytesAsText(
          boundary.start,
          boundary.end
        );

        if (content.toLowerCase().includes(lowerCaseQuery)) {
          // Use absolute position in boundaries array so results stay aligned
          // with sorted/paginated message lists in the UI.
          matchingIndices.push(i);
        }

        // Report progress at adaptive intervals for smooth feedback
        if ((i + 1) % progressInterval === 0 || i + 1 === boundaries.length) {
          const progress = Math.round(((i + 1) / boundaries.length) * 100);
          self.postMessage({ type: "PROGRESS", payload: progress });
        }
      }

      if (!isAborted) {
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
