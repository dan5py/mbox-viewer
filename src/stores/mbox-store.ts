import { create } from "zustand";

import { EmailMessage, MailFile } from "~/types/files";
import { loadMessageFromRange } from "~/lib/mbox-parser";

interface MboxState {
  files: MailFile[];
  selectedFileId: string | null;
  selectedMessageId: string | null;
  messagesPerPage: number;
  isUploading: boolean;
  isParsing: boolean;

  // Actions
  addFile: (file: MailFile) => void;
  removeFile: (fileId: string) => void;
  renameFile: (fileId: string, nextName: string) => void;
  setSelectedFile: (fileId: string | null) => void;
  setSelectedMessage: (messageId: string | null) => void;
  setIsUploading: (uploading: boolean) => void;
  setIsParsing: (parsing: boolean) => void;
  // Message loading
  loadMessage: (
    fileId: string,
    messageIndex: number,
    options?: { cache?: boolean }
  ) => Promise<EmailMessage>;
}

function getUniqueFileName(
  proposedName: string,
  existingNames: Set<string>
): string {
  const normalizedExistingNames = new Set(
    Array.from(existingNames).map((name) => name.toLowerCase())
  );
  const normalizedProposedName = proposedName.toLowerCase();

  if (!normalizedExistingNames.has(normalizedProposedName)) {
    return proposedName;
  }

  const dotIndex = proposedName.lastIndexOf(".");
  const hasExtension = dotIndex > 0;
  const stem = hasExtension ? proposedName.slice(0, dotIndex) : proposedName;
  const extension = hasExtension ? proposedName.slice(dotIndex) : "";

  let counter = 2;
  let candidate = `${stem} (${counter})${extension}`;

  while (normalizedExistingNames.has(candidate.toLowerCase())) {
    counter++;
    candidate = `${stem} (${counter})${extension}`;
  }

  return candidate;
}

const useMboxStore = create<MboxState>((set, get) => ({
  files: [],
  selectedFileId: null,
  selectedMessageId: null,
  messagesPerPage: 50,
  isUploading: false,
  isParsing: false,

  addFile: (file: MailFile) => {
    // Sort messages by date (newest first)
    if (file.messageBoundaries) {
      file.messageBoundaries.sort((a, b) => {
        const dateA = a.preview?.date ? new Date(a.preview.date).getTime() : 0;
        const dateB = b.preview?.date ? new Date(b.preview.date).getTime() : 0;
        return dateB - dateA;
      });

      // Keep boundary indices aligned with array position after sorting.
      // Downstream features (search, pagination, export selection) rely on
      // absolute positions in this ordered list.
      file.messageBoundaries.forEach((boundary, index) => {
        boundary.index = index;
      });
    }

    set((state) => {
      const existingNames = new Set(state.files.map((f) => f.name));
      const uniqueName = getUniqueFileName(file.name, existingNames);
      const fileToStore =
        uniqueName === file.name ? file : { ...file, name: uniqueName };

      return {
        files: [...state.files, fileToStore],
        selectedFileId: file.id, // Auto-select new file
      };
    });
  },

  removeFile: (fileId: string) => {
    set((state) => {
      const isSelectedFile = state.selectedFileId === fileId;
      const remainingFiles = state.files.filter((f) => f.id !== fileId);
      const nextSelectedFileId = isSelectedFile
        ? (remainingFiles[0]?.id ?? null)
        : state.selectedFileId;

      return {
        files: remainingFiles,
        selectedFileId: nextSelectedFileId,
        selectedMessageId: isSelectedFile ? null : state.selectedMessageId,
      };
    });
  },

  renameFile: (fileId: string, nextName: string) => {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      return;
    }

    set((state) => {
      const existingNames = new Set(
        state.files
          .filter((file) => file.id !== fileId)
          .map((file) => file.name)
      );
      const uniqueName = getUniqueFileName(trimmedName, existingNames);

      return {
        files: state.files.map((file) =>
          file.id === fileId ? { ...file, name: uniqueName } : file
        ),
      };
    });
  },

  setSelectedFile: (fileId: string | null) => {
    set({
      selectedFileId: fileId,
      selectedMessageId: null,
    });
  },

  setSelectedMessage: (messageId: string | null) => {
    set({ selectedMessageId: messageId });
  },

  setIsUploading: (uploading: boolean) => {
    set({ isUploading: uploading });
  },
  setIsParsing: (parsing: boolean) => {
    set({ isParsing: parsing });
  },

  loadMessage: async (
    fileId: string,
    messageIndex: number,
    options?: { cache?: boolean }
  ) => {
    const state = get();
    const file = state.files.find((f) => f.id === fileId);
    const shouldUseCache = options?.cache ?? true;
    const MAX_CACHED_MESSAGES_PER_FILE = 40;

    if (!file || !file.fileReader || !file.messageBoundaries) {
      throw new Error("File not properly initialized");
    }

    // Check cache first
    if (shouldUseCache && !file.messageCache) {
      file.messageCache = new Map();
    }

    if (shouldUseCache && file.messageCache?.has(messageIndex)) {
      const cachedMessage = file.messageCache.get(messageIndex)!;
      // Refresh insertion order to approximate LRU behavior.
      file.messageCache.delete(messageIndex);
      file.messageCache.set(messageIndex, cachedMessage);
      return cachedMessage;
    }

    // Load from file
    const boundary = file.messageBoundaries[messageIndex];
    if (!boundary) {
      throw new Error(`Message ${messageIndex} not found`);
    }

    const message = await loadMessageFromRange(
      file.fileReader,
      boundary.start,
      boundary.end,
      messageIndex
    );

    if (shouldUseCache && file.messageCache) {
      // Cache it
      file.messageCache.set(messageIndex, message);

      while (file.messageCache.size > MAX_CACHED_MESSAGES_PER_FILE) {
        const oldestKey = file.messageCache.keys().next().value as
          | number
          | undefined;
        if (oldestKey === undefined) {
          break;
        }
        file.messageCache.delete(oldestKey);
      }
    }

    return message;
  },
}));

export default useMboxStore;
