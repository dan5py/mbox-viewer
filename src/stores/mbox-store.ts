import { create } from "zustand";

import { EmailMessage, MailFile } from "~/types/files";
import { loadMessageFromRange } from "~/lib/mbox-parser";

interface MboxState {
  files: MailFile[];
  selectedFileId: string | null;
  selectedMessageId: string | null;
  searchQuery: string;
  selectedLabel: string | null; // null means "All emails"
  currentPage: number;
  messagesPerPage: number;
  isUploading: boolean;
  isParsing: boolean;

  // Actions
  addFile: (file: MailFile) => void;
  removeFile: (fileId: string) => void;
  renameFile: (fileId: string, nextName: string) => void;
  setSelectedFile: (fileId: string | null) => void;
  setSelectedMessage: (messageId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedLabel: (label: string | null) => void;
  setCurrentPage: (page: number) => void;
  setIsUploading: (uploading: boolean) => void;
  setIsParsing: (parsing: boolean) => void;
  // Message loading
  loadMessage: (fileId: string, messageIndex: number) => Promise<EmailMessage>;
}

const useMboxStore = create<MboxState>((set, get) => ({
  files: [],
  selectedFileId: null,
  selectedMessageId: null,
  searchQuery: "",
  selectedLabel: null,
  currentPage: 1,
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

    set((state) => ({
      files: [...state.files, file],
      selectedFileId: file.id, // Auto-select new file
    }));
  },

  removeFile: (fileId: string) => {
    set((state) => {
      const isSelectedFile = state.selectedFileId === fileId;
      return {
        files: state.files.filter((f) => f.id !== fileId),
        selectedFileId: isSelectedFile ? null : state.selectedFileId,
        selectedMessageId: null,
        // Clear search and reset page if deleting the selected file
        searchQuery: isSelectedFile ? "" : state.searchQuery,
        selectedLabel: isSelectedFile ? null : state.selectedLabel,
        currentPage: isSelectedFile ? 1 : state.currentPage,
      };
    });
  },

  renameFile: (fileId: string, nextName: string) => {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      return;
    }

    set((state) => ({
      files: state.files.map((file) =>
        file.id === fileId ? { ...file, name: trimmedName } : file
      ),
    }));
  },

  setSelectedFile: (fileId: string | null) => {
    set({
      selectedFileId: fileId,
      selectedMessageId: null,
      currentPage: 1,
      searchQuery: "",
      selectedLabel: null,
    });
  },

  setSelectedMessage: (messageId: string | null) => {
    set({ selectedMessageId: messageId });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query, currentPage: 1 });
  },

  setSelectedLabel: (label: string | null) => {
    set({ selectedLabel: label, currentPage: 1 });
  },

  setCurrentPage: (page: number) => {
    set({ currentPage: page });
  },

  setIsUploading: (uploading: boolean) => {
    set({ isUploading: uploading });
  },
  setIsParsing: (parsing: boolean) => {
    set({ isParsing: parsing });
  },

  loadMessage: async (fileId: string, messageIndex: number) => {
    const state = get();
    const file = state.files.find((f) => f.id === fileId);

    if (!file || !file.fileReader || !file.messageBoundaries) {
      throw new Error("File not properly initialized");
    }

    // Check cache first
    if (!file.messageCache) {
      file.messageCache = new Map();
    }

    if (file.messageCache.has(messageIndex)) {
      return file.messageCache.get(messageIndex)!;
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

    // Cache it
    file.messageCache.set(messageIndex, message);

    return message;
  },
}));

export default useMboxStore;
