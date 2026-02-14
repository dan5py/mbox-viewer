"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import useMboxStore from "~/stores/mbox-store";
import { formatDate, formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { it } from "date-fns/locale/it";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  CodeXml,
  Download,
  Eye,
  FileText,
  Mail,
  Maximize2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  ScanText,
  Search,
  TextInitial,
  Trash,
  User,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { EmailAttachment, EmailMessage } from "~/types/files";
import { ExportFormat, exportMessages } from "~/lib/message-export";
import { PREVIEWABLE_MIME_TYPES } from "~/lib/mime-types";
import { cn } from "~/lib/utils";
import { useDebounce } from "~/hooks/use-debounce";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { FileUploadInput } from "~/components/files-uploader/input";
import { Navbar } from "~/components/navbar";
import HtmlRenderer from "~/components/viewer/html-renderer";

export default function ViewerPage() {
  const t = useTranslations("Viewer");
  const locale = useLocale();
  const dateLocale = locale === "it" ? it : enUS;
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<
    number | null
  >(null);
  const [selectedMessageData, setSelectedMessageData] =
    useState<EmailMessage | null>(null);
  const loadingAbortRef = useRef<AbortController | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<number[] | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selectedMessageIndices, setSelectedMessageIndices] = useState<
    Set<number>
  >(new Set());
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isLabelOverflowMenuOpen, setIsLabelOverflowMenuOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mbox");
  const [includeAttachmentsInExport, setIncludeAttachmentsInExport] =
    useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isApplePlatform, setIsApplePlatform] = useState<boolean | null>(null);
  const [tab, setTab] = useState("body");
  const labelOverflowMenuContentId = useId();

  // Compute effective tab: fallback to first available if current tab is not available
  const { effectiveTab, hasBody, hasAttachments } = useMemo(() => {
    const hasBody = !!(
      selectedMessageData?.htmlBody || selectedMessageData?.body
    );
    const hasAttachments = !!(
      selectedMessageData?.attachments &&
      selectedMessageData.attachments.length > 0
    );

    const isCurrentTabValid =
      (tab === "body" && hasBody) ||
      (tab === "attachments" && hasAttachments) ||
      tab === "headers";

    const effectiveTab = isCurrentTabValid ? tab : hasBody ? "body" : "headers";

    return { effectiveTab, hasBody, hasAttachments };
  }, [selectedMessageData, tab]);
  const [expandedRecipients, setExpandedRecipients] = useState<{
    to: boolean;
    cc: boolean;
  }>({ to: false, cc: false });
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [bodyTab, setBodyTab] = useState<"html" | "text">("html");
  const [previewedAttachment, setPreviewedAttachment] =
    useState<EmailAttachment | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const searchWorker = useRef<Worker | null>(null);
  const messageRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const lastNavTimeRef = useRef<number>(0);
  const lastSelectionAnchorRef = useRef<number | null>(null);
  const previousSearchQueryRef = useRef("");
  const store = useMboxStore();

  const {
    files,
    selectedFileId,
    searchQuery,
    selectedLabel,
    currentPage,
    messagesPerPage,
    setSelectedFile,
    setSelectedMessage,
    setSearchQuery,
    setSelectedLabel,
    setCurrentPage,
    renameFile,
    loadMessage,
  } = useMboxStore();

  // Initialize the search worker
  useEffect(() => {
    const worker = new Worker(
      new URL("~/workers/search.worker.ts", import.meta.url),
      { type: "module" }
    );
    searchWorker.current = worker;

    searchWorker.current.onmessage = (
      event: MessageEvent<
        | { type: "RESULTS"; payload: number[] }
        | { type: "ERROR"; payload: string }
        | { type: "PROGRESS"; payload: number }
      >
    ) => {
      const { type, payload } = event.data;
      if (type === "RESULTS") {
        setSearchResults(payload);
        setIsSearching(false);
        setSearchProgress(100);
        setSearchFailed(false);
      } else if (type === "PROGRESS") {
        setSearchProgress(payload);
      } else if (type === "ERROR") {
        console.error("Search worker error:", payload);
        setIsSearching(false);
        setSearchProgress(0);
        setSearchResults([]);
        setSearchFailed(true);
      }
    };

    return () => {
      searchWorker.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const userAgentDataPlatform =
      "userAgentData" in navigator
        ? (
            navigator as Navigator & {
              userAgentData?: { platform?: string };
            }
          ).userAgentData?.platform
        : undefined;

    const uaPlatform = (
      userAgentDataPlatform ||
      navigator.platform ||
      ""
    ).toLowerCase();
    const isAppleDevice =
      uaPlatform.includes("mac") ||
      uaPlatform.includes("iphone") ||
      uaPlatform.includes("ipad");

    setIsApplePlatform(isAppleDevice);
  }, []);

  // Warn user before reloading/leaving if files are loaded
  useEffect(() => {
    if (files.length === 0) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [files.length]);

  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const normalizedSearchQuery = debouncedSearchQuery.trim();
  const hasSearchQuery = searchQuery.trim().length > 0;

  const currentFile = files.find((f) => f.id === selectedFileId);
  const shortcutModifierLabel =
    isApplePlatform === null ? "Ctrl/Cmd" : isApplePlatform ? "⌘" : "Ctrl";

  // Reset selection when switching files
  useEffect(() => {
    exportAbortRef.current?.abort();
    lastSelectionAnchorRef.current = null;
    setSelectedMessageIndex(null);
    setSelectedMessageData(null);
    setSelectedMessageIndices(new Set());
    setIsActionsMenuOpen(false);
    setIsLabelOverflowMenuOpen(false);
    setIsExportDialogOpen(false);
    setIsShortcutsDialogOpen(false);
    setExportProgress(0);
    setEditingFileId(null);
    setEditingFileName("");
  }, [selectedFileId]);

  useEffect(() => {
    return () => {
      exportAbortRef.current?.abort();
    };
  }, []);

  // Effect to trigger search in worker
  useEffect(() => {
    if (
      normalizedSearchQuery &&
      searchWorker &&
      currentFile?.fileReader?.file
    ) {
      if (!currentFile.messageBoundaries) {
        console.warn("Cannot search, message boundaries not scanned.");
        return;
      }

      // Abort any ongoing search before starting a new one
      searchWorker.current?.postMessage({
        type: "ABORT",
      });

      setIsSearching(true);
      setSearchProgress(0);
      setSearchFailed(false);
      setSearchResults(null); // Reset previous results
      setCurrentPage(1); // Go back to the first page for new search

      searchWorker.current?.postMessage({
        type: "SEARCH",
        payload: {
          file: currentFile.fileReader.file,
          boundaries: currentFile.messageBoundaries,
          query: normalizedSearchQuery,
        },
      });
    } else if (!normalizedSearchQuery) {
      // Clear search results when query is cleared
      searchWorker.current?.postMessage({
        type: "ABORT",
      });
      setIsSearching(false);
      setSearchProgress(0);
      setSearchFailed(false);
      setSearchResults(null);
    }
  }, [normalizedSearchQuery, searchWorker, currentFile, setCurrentPage]);

  // Immediate selection handler - updates index without waiting for load
  const handleSelectMessage = useCallback(
    (index: number) => {
      if (!currentFile?.id) return;

      // Toggle off if same message is selected
      if (selectedMessageIndex === index) {
        setSelectedMessageIndex(null);
        setSelectedMessage(null);
        setSelectedMessageData(null);
        return;
      }

      // Abort any pending load
      if (loadingAbortRef.current) {
        loadingAbortRef.current.abort();
      }

      // Reset expanded recipients and header when switching messages
      setExpandedRecipients({ to: false, cc: false });
      setHeaderExpanded(false);

      // Update selection immediately for responsive navigation
      setSelectedMessageIndex(index);
      setSelectedMessage(`msg-${index}`);

      // Scroll the selected message into view
      // Use instant scroll when navigating rapidly (holding key), smooth for single presses
      const now = performance.now();
      const timeSinceLastNav = now - lastNavTimeRef.current;
      lastNavTimeRef.current = now;
      const isRapidNav = timeSinceLastNav < 150;

      requestAnimationFrame(() => {
        const messageEl = messageRefs.current.get(index);
        if (messageEl) {
          messageEl.scrollIntoView({
            block: "nearest",
            behavior: isRapidNav ? "auto" : "smooth",
          });
        }
      });
    },
    [currentFile?.id, selectedMessageIndex, setSelectedMessage]
  );

  // Debounced message loading - only loads after navigation stops
  const debouncedSelectedIndex = useDebounce(selectedMessageIndex, 150);

  useEffect(() => {
    if (debouncedSelectedIndex === null || !currentFile?.id) {
      return;
    }

    // Skip if we already have this message loaded
    if (selectedMessageData?.id === `msg-${debouncedSelectedIndex}`) {
      return;
    }

    const abortController = new AbortController();
    loadingAbortRef.current = abortController;

    const loadSelectedMessage = async () => {
      setLoadingMessage(true);
      try {
        const message = await loadMessage(
          currentFile.id,
          debouncedSelectedIndex
        );
        // Only update if not aborted
        if (!abortController.signal.aborted) {
          setSelectedMessageData(message);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error("Failed to load message:", err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingMessage(false);
        }
      }
    };

    loadSelectedMessage();

    return () => {
      abortController.abort();
    };
  }, [
    debouncedSelectedIndex,
    currentFile?.id,
    selectedMessageData?.id,
    loadMessage,
  ]);

  // Get message preview from boundaries
  const getMessagePreview = (index: number) => {
    if (!currentFile?.messageBoundaries) return null;
    const boundary = currentFile.messageBoundaries[index];
    return boundary?.preview;
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Helper functions for attachment preview
  const isImageType = (mimeType: string): boolean => {
    return PREVIEWABLE_MIME_TYPES.includes(mimeType);
  };

  const isPdfType = (mimeType: string): boolean => {
    return mimeType === "application/pdf";
  };

  const isTextType = (mimeType: string): boolean => {
    return (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/xml" ||
      mimeType === "application/javascript"
    );
  };

  // Convert base64 to Blob - more efficient and no size limits unlike data URLs
  const base64ToBlob = useCallback((base64: string, mimeType: string): Blob => {
    const binaryData = atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }, []);

  // Create object URL for attachment preview - handles large files better than data URLs
  useEffect(() => {
    let url: string | null = null;

    if (previewedAttachment) {
      try {
        const blob = base64ToBlob(
          previewedAttachment.data,
          previewedAttachment.mimeType
        );
        url = URL.createObjectURL(blob);
        setPreviewObjectUrl(url);
      } catch (err) {
        console.error("Failed to create preview URL:", err);
        setPreviewObjectUrl(null);
      }
    } else {
      setPreviewObjectUrl(null);
    }

    // Cleanup: revoke object URL when attachment changes or component unmounts
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewedAttachment, base64ToBlob]);

  const getAttachmentDataUrl = (att: EmailAttachment): string => {
    return `data:${att.mimeType};base64,${att.data}`;
  };

  const downloadAttachment = (att: EmailAttachment) => {
    try {
      let bytes: Uint8Array;

      if (att.encoding === "base64") {
        const binaryData = atob(att.data.replace(/\s/g, ""));
        bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
      } else {
        bytes = new TextEncoder().encode(att.data);
      }

      const blob = new Blob([new Uint8Array(bytes)], {
        type: att.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.filename;
      a.click();
      // Delay revocation to avoid race conditions in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Failed to download attachment:", err);
    }
  };

  // Get initials from email address or name
  const getInitials = (str: string): string => {
    if (!str) return "?";

    // Normalize the "from" string to ensure consistent formatting
    const normalized = normalizeFromString(str);

    // Try to extract name from "Name <email@example.com>" format
    let nameMatch = normalized.match(/^(.+?)\s*<.+>$/);
    if (!nameMatch) {
      // Try without angle brackets: "Name" email@example.com or Name email@example.com
      nameMatch = normalized.match(
        /^(.+?)\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      );
    }

    const name = nameMatch ? nameMatch[1].trim() : normalized.split("@")[0];

    // Remove quotes from name
    const cleanName = name.replace(/^["']|["']$/g, "").trim();

    // If name is empty or just whitespace, try to extract from email
    if (!cleanName || cleanName.length === 0) {
      const emailPart = normalized.split("@")[0];
      return emailPart.substring(0, 2).toUpperCase();
    }

    const parts = cleanName.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  };

  // Normalize "from" string to consistent format
  // This ensures both preview and full message use the same format
  const normalizeFromString = (str: string): string => {
    if (!str) return "Unknown";

    // Remove extra whitespace
    str = str.trim();

    // Handle quoted names: "Name" <email@example.com> or 'Name' <email@example.com>
    // Convert to: Name <email@example.com>
    str = str.replace(/^"([^"]+)"\s*</, "$1 <");
    str = str.replace(/^'([^']+)'\s*</, "$1 <");

    // Handle case where email is in angle brackets but name might have quotes
    // "Name" <email@example.com> -> Name <email@example.com>
    str = str.replace(/"([^"]+)"\s*</g, "$1 <");
    str = str.replace(/'([^']+)'\s*</g, "$1 <");

    // Normalize multiple spaces to single space
    str = str.replace(/\s+/g, " ");

    return str;
  };

  // Get color for avatar based on string
  const getAvatarColor = (str: string): string => {
    // Normalize the string to ensure consistent color
    const normalized = normalizeFromString(str);

    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-indigo-500",
      "bg-red-500",
    ];
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Parse email address string into name and email
  const parseEmailAddress = (
    addressStr: string
  ): { name: string; email: string } => {
    if (!addressStr) return { name: "", email: "" };

    // Handle format: "Name <email@example.com>"
    const bracketMatch = addressStr.match(/^(.+?)\s*<(.+?)>$/);
    if (bracketMatch) {
      return {
        name: bracketMatch[1].trim().replace(/^["']|["']$/g, ""), // Remove quotes
        email: bracketMatch[2].trim(),
      };
    }

    // Handle format: "<email@example.com>" (no name)
    if (addressStr.startsWith("<") && addressStr.endsWith(">")) {
      return {
        name: "",
        email: addressStr.slice(1, -1).trim(),
      };
    }

    // Handle format: "email@example.com" (no name)
    if (addressStr.includes("@")) {
      return {
        name: "",
        email: addressStr.trim(),
      };
    }

    // Fallback
    return {
      name: addressStr.trim(),
      email: "",
    };
  };

  // Format email addresses for display (handles multiple addresses)
  const formatEmailAddresses = (
    addressesStr: string | undefined
  ): Array<{ name: string; email: string }> => {
    if (!addressesStr) return [];

    // Split by comma, but be careful with quoted names that might contain commas
    const addresses: Array<{ name: string; email: string }> = [];
    let current = "";
    let inQuotes = false;
    let inBrackets = 0;

    for (let i = 0; i < addressesStr.length; i++) {
      const char = addressesStr[i];

      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === "<") {
        inBrackets++;
        current += char;
      } else if (char === ">") {
        inBrackets--;
        current += char;
      } else if (char === "," && !inQuotes && inBrackets === 0) {
        // Split point
        const parsed = parseEmailAddress(current.trim());
        if (parsed.email || parsed.name) {
          addresses.push(parsed);
        }
        current = "";
      } else {
        current += char;
      }
    }

    // Add the last address
    if (current.trim()) {
      const parsed = parseEmailAddress(current.trim());
      if (parsed.email || parsed.name) {
        addresses.push(parsed);
      }
    }

    return addresses.length > 0 ? addresses : [parseEmailAddress(addressesStr)];
  };

  // Component to render recipient list with show more/less
  const RecipientList = ({
    addresses,
    maxVisible = 2,
    type,
  }: {
    addresses: Array<{ name: string; email: string }>;
    maxVisible?: number;
    type: "to" | "cc";
  }) => {
    const isExpanded = expandedRecipients[type];
    const hasMore = addresses.length > maxVisible;
    const visibleAddresses = isExpanded
      ? addresses
      : addresses.slice(0, maxVisible);

    if (addresses.length === 0) {
      return (
        <span className="text-sm text-muted-foreground italic">
          {t("preview.unknown")}
        </span>
      );
    }

    return (
      <div className="space-y-1.5">
        {visibleAddresses.map((addr, idx) => (
          <div key={idx} className="flex items-center gap-2 min-w-0">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              {addr.name ? (
                <>
                  <span
                    className="text-sm font-medium text-foreground truncate"
                    title={addr.name}
                  >
                    {addr.name}
                  </span>
                  <span
                    className="text-xs text-muted-foreground truncate"
                    title={addr.email}
                  >
                    {addr.email}
                  </span>
                </>
              ) : (
                <span
                  className="text-sm text-foreground truncate"
                  title={addr.email || t("preview.unknown")}
                >
                  {addr.email || t("preview.unknown")}
                </span>
              )}
            </div>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() =>
              setExpandedRecipients((prev) => ({
                ...prev,
                [type]: !prev[type],
              }))
            }
            className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 font-medium transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-3" />
                {t("preview.less")}
              </>
            ) : (
              <>
                <ChevronDown className="size-3" />
                {t("preview.more", { count: addresses.length - maxVisible })}
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  const { removeFile } = useMboxStore();

  // Handle file deletion with cleanup
  const handleDeleteFile = (fileId: string) => {
    const isSelectedFile = selectedFileId === fileId;

    // Abort any ongoing search if deleting the selected file
    if (isSelectedFile && searchWorker.current) {
      searchWorker.current.postMessage({ type: "ABORT" });
      setIsSearching(false);
      setSearchProgress(0);
      setSearchFailed(false);
      setSearchResults(null);
    }

    // Clear selected message data if deleting the selected file
    if (isSelectedFile) {
      setSelectedMessageIndex(null);
      setSelectedMessageData(null);
      setSelectedMessageIndices(new Set());
    }

    if (editingFileId === fileId) {
      setEditingFileId(null);
      setEditingFileName("");
    }

    removeFile(fileId);
  };

  const handleStartRenameFile = useCallback(
    (fileId: string, currentName: string) => {
      setEditingFileId(fileId);
      setEditingFileName(currentName);
    },
    []
  );

  const handleCancelRenameFile = useCallback(() => {
    setEditingFileId(null);
    setEditingFileName("");
  }, []);

  const handleCommitRenameFile = useCallback(() => {
    if (!editingFileId) {
      return;
    }

    const normalizedName = editingFileName.trim();
    if (!normalizedName) {
      handleCancelRenameFile();
      return;
    }

    renameFile(editingFileId, normalizedName);
    setEditingFileId(null);
    setEditingFileName("");
  }, [editingFileId, editingFileName, handleCancelRenameFile, renameFile]);

  const labelToMessageIndices = useMemo(() => {
    const indicesByLabel = new Map<string, number[]>();
    if (!currentFile?.messageBoundaries) {
      return indicesByLabel;
    }

    for (let index = 0; index < currentFile.messageBoundaries.length; index++) {
      const boundaryLabels =
        currentFile.messageBoundaries[index]?.preview?.labels;
      if (!boundaryLabels || boundaryLabels.length === 0) {
        continue;
      }

      for (const label of new Set(boundaryLabels)) {
        const labelIndices = indicesByLabel.get(label);
        if (labelIndices) {
          labelIndices.push(index);
        } else {
          indicesByLabel.set(label, [index]);
        }
      }
    }

    return indicesByLabel;
  }, [currentFile]);
  const labelMessageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [label, indices] of labelToMessageIndices.entries()) {
      counts.set(label, indices.length);
    }
    return counts;
  }, [labelToMessageIndices]);
  const labelSortCollator = useMemo(
    () =>
      new Intl.Collator(locale, {
        sensitivity: "base",
        numeric: true,
      }),
    [locale]
  );

  // Extract all unique labels from the current file
  const allLabels = useMemo(() => {
    return Array.from(labelToMessageIndices.keys()).sort(
      labelSortCollator.compare
    );
  }, [labelSortCollator, labelToMessageIndices]);

  useEffect(() => {
    if (selectedLabel !== null && !labelToMessageIndices.has(selectedLabel)) {
      setSelectedLabel(null);
    }
  }, [labelToMessageIndices, selectedLabel, setSelectedLabel]);

  // Compute visible message indices (before early return to use in keyboard navigation)
  const totalMessages = currentFile?.messageCount || 0;
  const searchResultCount = searchResults?.length ?? null;

  // Filter messages by label if a label is selected
  const labelFilteredIndices = useMemo(() => {
    if (selectedLabel === null) {
      return null; // null means no label filtering
    }

    return labelToMessageIndices.get(selectedLabel) ?? [];
  }, [labelToMessageIndices, selectedLabel]);

  const searchResultSet = useMemo(
    () => (searchResults ? new Set(searchResults) : null),
    [searchResults]
  );
  const labelDisplayCounts = useMemo(() => {
    if (!searchResultSet || !currentFile?.messageBoundaries) {
      return labelMessageCounts;
    }

    const counts = new Map<string, number>();
    for (const index of searchResultSet) {
      const labels = currentFile.messageBoundaries[index]?.preview?.labels;
      if (!labels || labels.length === 0) {
        continue;
      }

      for (const label of new Set(labels)) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }

    for (const label of allLabels) {
      if (!counts.has(label)) {
        counts.set(label, 0);
      }
    }

    return counts;
  }, [
    allLabels,
    currentFile?.messageBoundaries,
    labelMessageCounts,
    searchResultSet,
  ]);
  const labelFiltersForLayout = useMemo(() => {
    if (!searchResultSet) {
      return allLabels;
    }

    return allLabels
      .filter((label) => {
        if (selectedLabel === label) {
          return true;
        }

        return (labelDisplayCounts.get(label) ?? 0) > 0;
      })
      .sort((a, b) => {
        if (selectedLabel === a) return -1;
        if (selectedLabel === b) return 1;

        const countDiff =
          (labelDisplayCounts.get(b) ?? 0) - (labelDisplayCounts.get(a) ?? 0);
        if (countDiff !== 0) {
          return countDiff;
        }

        return labelSortCollator.compare(a, b);
      });
  }, [
    allLabels,
    labelDisplayCounts,
    labelSortCollator,
    searchResultSet,
    selectedLabel,
  ]);
  const maxInlineLabelFilters = 8;
  const { inlineLabelFilters, overflowLabelFilters } = useMemo(() => {
    if (labelFiltersForLayout.length <= maxInlineLabelFilters) {
      return {
        inlineLabelFilters: labelFiltersForLayout,
        overflowLabelFilters: [],
      };
    }

    if (selectedLabel && labelFiltersForLayout.includes(selectedLabel)) {
      const selectedLabelIndex = labelFiltersForLayout.indexOf(selectedLabel);
      if (selectedLabelIndex >= maxInlineLabelFilters) {
        const pinnedInlineLabels = [
          ...labelFiltersForLayout.slice(0, maxInlineLabelFilters - 1),
          selectedLabel,
        ];
        const pinnedInlineLabelSet = new Set(pinnedInlineLabels);
        const remainingOverflowLabels = labelFiltersForLayout.filter(
          (label) => !pinnedInlineLabelSet.has(label)
        );

        return {
          inlineLabelFilters: pinnedInlineLabels,
          overflowLabelFilters: remainingOverflowLabels,
        };
      }
    }

    return {
      inlineLabelFilters: labelFiltersForLayout.slice(0, maxInlineLabelFilters),
      overflowLabelFilters: labelFiltersForLayout.slice(maxInlineLabelFilters),
    };
  }, [labelFiltersForLayout, selectedLabel]);

  useEffect(() => {
    if (overflowLabelFilters.length === 0 && isLabelOverflowMenuOpen) {
      setIsLabelOverflowMenuOpen(false);
    }
  }, [overflowLabelFilters.length, isLabelOverflowMenuOpen]);

  useEffect(() => {
    if (
      previousSearchQueryRef.current !== searchQuery &&
      isLabelOverflowMenuOpen
    ) {
      setIsLabelOverflowMenuOpen(false);
    }
    previousSearchQueryRef.current = searchQuery;
  }, [isLabelOverflowMenuOpen, searchQuery]);

  const filteredMessageIndices = useMemo(() => {
    if (!(files.length > 0 && currentFile)) return [];

    // First apply label filter if selected
    let baseIndices: number[] | null = null;
    if (labelFilteredIndices !== null) {
      baseIndices = labelFilteredIndices;
    } else {
      // No label filter, use all messages
      baseIndices = Array.from({ length: totalMessages }, (_, i) => i);
    }

    // Then apply search filter if search results exist
    let filteredIndices = baseIndices;
    if (searchResultSet) {
      filteredIndices = baseIndices.filter((idx) => searchResultSet.has(idx));
    }

    return filteredIndices;
  }, [
    files.length,
    currentFile,
    totalMessages,
    labelFilteredIndices,
    searchResultSet,
  ]);

  const visibleMessageIndices = useMemo(() => {
    const startIndex = (currentPage - 1) * messagesPerPage;
    return filteredMessageIndices.slice(
      startIndex,
      startIndex + messagesPerPage
    );
  }, [currentPage, filteredMessageIndices, messagesPerPage]);

  const selectedCount = selectedMessageIndices.size;
  const integerFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale]
  );
  const selectedCountLabel = t("selection.selectedCount", {
    count: selectedCount,
  });
  const selectedMenuLabel = t("selection.selectedMenuLabel", {
    count: selectedCount,
  });
  const actionsTriggerLabel = t("selection.actionsAriaLabel", {
    count: selectedCount,
  });
  const selectedCountBadgeLabel =
    selectedCount > 99
      ? `${integerFormatter.format(99)}+`
      : integerFormatter.format(selectedCount);
  const visibleCountLabel = integerFormatter.format(
    visibleMessageIndices.length
  );
  const filteredCountLabel = integerFormatter.format(
    filteredMessageIndices.length
  );
  const allEmailsLabel = t("search.allEmails");
  const allEmailsFilterCountValue = searchResultSet
    ? searchResultSet.size
    : totalMessages;
  const allEmailsFilterCount = integerFormatter.format(
    allEmailsFilterCountValue
  );
  const labelFilterOptionsCount =
    1 + inlineLabelFilters.length + (overflowLabelFilters.length > 0 ? 1 : 0);
  const labelFiltersGroupLabel = t("search.labelFiltersWithCount", {
    count: labelFilterOptionsCount,
  });
  const toggleFilteredSelectionShortcutLabel = `${shortcutModifierLabel}+A`;
  const clearSelectionShortcutLabel = `Shift+${shortcutModifierLabel}+A`;
  const resetFiltersShortcutLabel = "Shift+Esc";
  const openShortcutsShortcutLabel = "?";
  const toggleFilteredSelectionAriaKeyShortcuts = "Control+A Meta+A";
  const clearSelectionAriaKeyShortcuts = "Shift+Control+A Shift+Meta+A";
  const resetFiltersAriaKeyShortcuts = "Shift+Escape";
  const openShortcutsAriaKeyShortcuts = "Shift+Slash";
  const moreLabelsTriggerText = t("search.moreLabels", {
    count: overflowLabelFilters.length,
  });
  const moreLabelsTriggerAriaLabel = t("search.moreLabelsAria", {
    count: overflowLabelFilters.length,
  });
  const shouldShowLabelFiltersRow =
    allLabels.length > 0 &&
    (selectedLabel !== null || labelFiltersForLayout.length > 0);
  const getLabelMessageCount = (label: string) =>
    integerFormatter.format(labelDisplayCounts.get(label) ?? 0);
  const renderLabelChipContent = (
    label: string,
    count: string,
    isActive: boolean
  ) =>
    isActive ? (
      <span className="inline-flex max-w-full items-center gap-1">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums">({count})</span>
      </span>
    ) : (
      <span className="truncate">{label}</span>
    );
  const getLabelFilterButtonLabel = (label: string, count: number) =>
    t("search.labelWithCount", {
      label,
      count,
    });
  const allEmailsFilterAriaLabel = getLabelFilterButtonLabel(
    allEmailsLabel,
    allEmailsFilterCountValue
  );
  const allEmailsFilterTitle = `${allEmailsLabel} (${allEmailsFilterCount})`;
  const labelFilterChipBaseClassName =
    "inline-flex max-w-44 items-center rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors";
  const getLabelFilterChipClassName = (isActive: boolean) =>
    cn(
      labelFilterChipBaseClassName,
      isActive
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    );
  const handleSelectLabelFilter = useCallback(
    (label: string | null) => {
      if (label === null) {
        setSelectedLabel(null);
        return;
      }

      setSelectedLabel(selectedLabel === label ? null : label);
    },
    [selectedLabel, setSelectedLabel]
  );
  const handleSelectOverflowLabelFilter = useCallback(
    (label: string, checked: boolean | "indeterminate") => {
      if (checked === true) {
        setSelectedLabel(label);
      } else if (selectedLabel === label) {
        setSelectedLabel(null);
      }

      setIsLabelOverflowMenuOpen(false);
    },
    [selectedLabel, setSelectedLabel]
  );
  const handleSelectOverflowAllEmails = useCallback(() => {
    setSelectedLabel(null);
    setIsLabelOverflowMenuOpen(false);
  }, [setSelectedLabel]);
  const hasActiveFilters = selectedLabel !== null || searchQuery.trim() !== "";
  const allVisibleSelected =
    visibleMessageIndices.length > 0 &&
    visibleMessageIndices.every((idx) => selectedMessageIndices.has(idx));
  const allFilteredSelected =
    filteredMessageIndices.length > 0 &&
    filteredMessageIndices.every((idx) => selectedMessageIndices.has(idx));
  const togglePageSelectionLabel = allVisibleSelected
    ? t("selection.deselectPage")
    : t("selection.selectPage");
  const toggleFilteredSelectionLabel = allFilteredSelected
    ? hasActiveFilters
      ? t("selection.deselectFiltered")
      : t("selection.deselectAll")
    : hasActiveFilters
      ? t("selection.selectFiltered")
      : t("selection.selectAll");

  const handleToggleMessageSelection = useCallback(
    (index: number, extendRange = false) => {
      setSelectedMessageIndices((prev) => {
        const next = new Set(prev);
        const anchor = lastSelectionAnchorRef.current;

        if (extendRange && anchor !== null) {
          const anchorPos = filteredMessageIndices.indexOf(anchor);
          const currentPos = filteredMessageIndices.indexOf(index);
          const shouldSelectRange = !next.has(index);

          if (anchorPos !== -1 && currentPos !== -1) {
            const start = Math.min(anchorPos, currentPos);
            const end = Math.max(anchorPos, currentPos);

            for (let i = start; i <= end; i++) {
              const rangeIndex = filteredMessageIndices[i];
              if (shouldSelectRange) {
                next.add(rangeIndex);
              } else {
                next.delete(rangeIndex);
              }
            }
          } else {
            // If either endpoint is no longer in current filtered order,
            // fall back to toggling only the current message.
            if (shouldSelectRange) {
              next.add(index);
            } else {
              next.delete(index);
            }
          }
        } else if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }

        return next;
      });

      lastSelectionAnchorRef.current = index;
    },
    [filteredMessageIndices]
  );

  const handleToggleCurrentPageSelection = useCallback(() => {
    if (visibleMessageIndices.length === 0) {
      return;
    }

    setSelectedMessageIndices((prev) => {
      const next = new Set(prev);
      const everyVisibleSelected = visibleMessageIndices.every((idx) =>
        next.has(idx)
      );

      if (everyVisibleSelected) {
        for (const idx of visibleMessageIndices) {
          next.delete(idx);
        }
      } else {
        for (const idx of visibleMessageIndices) {
          next.add(idx);
        }
      }

      return next;
    });
  }, [visibleMessageIndices]);

  const handleToggleFilteredSelection = useCallback(() => {
    if (filteredMessageIndices.length === 0) {
      return;
    }

    setSelectedMessageIndices((prev) => {
      const next = new Set(prev);
      const everyFilteredSelected = filteredMessageIndices.every((idx) =>
        next.has(idx)
      );

      if (everyFilteredSelected) {
        for (const idx of filteredMessageIndices) {
          next.delete(idx);
        }
      } else {
        for (const idx of filteredMessageIndices) {
          next.add(idx);
        }
      }

      return next;
    });
  }, [filteredMessageIndices]);

  const handleClearSelection = useCallback(() => {
    lastSelectionAnchorRef.current = null;
    setSelectedMessageIndices(new Set());
  }, []);

  const resetSearchState = useCallback(() => {
    searchWorker.current?.postMessage({ type: "ABORT" });
    setIsSearching(false);
    setSearchProgress(0);
    setSearchFailed(false);
    setSearchResults(null);
  }, []);

  const handleSearchInputChange = useCallback(
    (value: string) => {
      if (value.trim().length === 0) {
        resetSearchState();
      } else {
        // Clear previous search error/progress while typing a new query.
        setSearchFailed(false);
        setSearchProgress(0);
      }
      setSearchQuery(value);
    },
    [resetSearchState, setSearchQuery]
  );

  const handleClearSearch = useCallback(() => {
    resetSearchState();
    setSearchQuery("");
  }, [resetSearchState, setSearchQuery]);

  const handleResetFilters = useCallback(() => {
    handleClearSearch();
    setSelectedLabel(null);
  }, [handleClearSearch, setSelectedLabel]);

  const handleToggleCurrentPageSelectionFromMenu = useCallback(() => {
    handleToggleCurrentPageSelection();
    setIsActionsMenuOpen(false);
  }, [handleToggleCurrentPageSelection]);

  const handleToggleFilteredSelectionFromMenu = useCallback(() => {
    handleToggleFilteredSelection();
    setIsActionsMenuOpen(false);
  }, [handleToggleFilteredSelection]);

  const handleClearSelectionFromMenu = useCallback(() => {
    handleClearSelection();
    setIsActionsMenuOpen(false);
  }, [handleClearSelection]);

  const handleResetFiltersFromMenu = useCallback(() => {
    handleResetFilters();
    setIsActionsMenuOpen(false);
  }, [handleResetFilters]);

  const handleOpenExportDialog = useCallback(() => {
    setIsActionsMenuOpen(false);
    setIsExportDialogOpen(true);
  }, []);

  const handleOpenShortcutsDialog = useCallback(() => {
    setIsActionsMenuOpen(false);
    setIsShortcutsDialogOpen(true);
  }, []);

  const exportLocalization = useMemo(
    () => ({
      locale,
      messageLabel: t("export.localization.message"),
      fromLabel: t("export.localization.from"),
      toLabel: t("export.localization.to"),
      ccLabel: t("export.localization.cc"),
      bccLabel: t("export.localization.bcc"),
      dateLabel: t("export.localization.date"),
      subjectLabel: t("export.localization.subject"),
      htmlDocumentTitle: t("export.localization.htmlDocumentTitle"),
      htmlHeading: t("export.localization.htmlHeading"),
      htmlExportedText: (count: number) =>
        t("export.localization.exportedCount", { count }),
    }),
    [locale, t]
  );

  const handleExportSelectedMessages = useCallback(async () => {
    if (!currentFile || selectedCount === 0) {
      return;
    }

    const abortController = new AbortController();
    exportAbortRef.current = abortController;

    setIsExporting(true);
    setExportProgress(0);

    try {
      await exportMessages({
        file: currentFile,
        selectedIndices: Array.from(selectedMessageIndices),
        format: exportFormat,
        includeAttachments: includeAttachmentsInExport,
        localization: exportLocalization,
        onProgress: setExportProgress,
        signal: abortController.signal,
        loadMessage,
      });
      setIsExportDialogOpen(false);
      toast.success(
        t("export.success", {
          count: selectedCount,
        })
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "EXPORT_NO_SELECTION") {
          toast.error(t("export.noSelection"));
          return;
        }
        if (error.message === "EXPORT_ABORTED") {
          toast.message(t("export.cancelled"));
          return;
        }
        if (error.message === "EXPORT_FILE_UNAVAILABLE") {
          toast.error(t("export.fileUnavailable"));
          return;
        }

        console.error("Export failed:", error);
      }
      toast.error(t("export.error"));
    } finally {
      exportAbortRef.current = null;
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [
    currentFile,
    selectedCount,
    selectedMessageIndices,
    exportFormat,
    includeAttachmentsInExport,
    exportLocalization,
    loadMessage,
    t,
  ]);

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (files.length === 0) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore global shortcuts while dialogs are open.
      if (
        isActionsMenuOpen ||
        isLabelOverflowMenuOpen ||
        isExportDialogOpen ||
        isShortcutsDialogOpen ||
        isFullscreenOpen ||
        !!previewedAttachment ||
        fileToDelete !== null
      ) {
        return;
      }

      // Don't interfere with editable fields
      if (e.target instanceof HTMLElement) {
        const tagName = e.target.tagName;
        const role = e.target.getAttribute("role");

        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          e.target.isContentEditable ||
          role === "textbox" ||
          role === "combobox" ||
          role === "spinbutton"
        ) {
          return;
        }
      }

      const isSelectAllShortcut =
        (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "a";
      const isOpenShortcutsHelpShortcut =
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "?" || (e.shiftKey && e.key === "/"));
      const isResetFiltersShortcut =
        e.key === "Escape" &&
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      const isClearPreviewSelectionShortcut =
        e.key === "Escape" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      const isNavigateNextShortcut =
        e.key === "ArrowDown" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      const isNavigatePreviousShortcut =
        e.key === "ArrowUp" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      const shouldIgnoreRepeatShortcut =
        e.repeat &&
        (isSelectAllShortcut ||
          isOpenShortcutsHelpShortcut ||
          isResetFiltersShortcut ||
          isClearPreviewSelectionShortcut);

      if (shouldIgnoreRepeatShortcut) {
        return;
      }

      if (isOpenShortcutsHelpShortcut) {
        e.preventDefault();
        handleOpenShortcutsDialog();
      } else if (isSelectAllShortcut) {
        e.preventDefault();
        if (e.shiftKey) {
          handleClearSelection();
        } else {
          handleToggleFilteredSelection();
        }
      } else if (isResetFiltersShortcut) {
        e.preventDefault();
        handleResetFilters();
      } else if (isNavigateNextShortcut) {
        if (visibleMessageIndices.length === 0) {
          return;
        }
        e.preventDefault();
        // Use selectedMessageIndex for instant navigation
        const currentPosInList = visibleMessageIndices.findIndex(
          (idx) => idx === selectedMessageIndex
        );
        if (currentPosInList < visibleMessageIndices.length - 1) {
          handleSelectMessage(visibleMessageIndices[currentPosInList + 1]);
        } else if (
          currentPosInList === -1 &&
          visibleMessageIndices.length > 0
        ) {
          // No selection, start from first
          handleSelectMessage(visibleMessageIndices[0]);
        }
      } else if (isNavigatePreviousShortcut) {
        if (visibleMessageIndices.length === 0) {
          return;
        }
        e.preventDefault();
        const currentPosInList = visibleMessageIndices.findIndex(
          (idx) => idx === selectedMessageIndex
        );
        if (currentPosInList > 0) {
          handleSelectMessage(visibleMessageIndices[currentPosInList - 1]);
        } else if (
          currentPosInList === -1 &&
          visibleMessageIndices.length > 0
        ) {
          // No selection, start from last
          handleSelectMessage(
            visibleMessageIndices[visibleMessageIndices.length - 1]
          );
        }
      } else if (isClearPreviewSelectionShortcut) {
        setSelectedMessageIndex(null);
        setSelectedMessage(null);
        setSelectedMessageData(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    visibleMessageIndices,
    selectedMessageIndex,
    handleSelectMessage,
    handleToggleFilteredSelection,
    handleClearSelection,
    handleResetFilters,
    handleOpenShortcutsDialog,
    isActionsMenuOpen,
    isLabelOverflowMenuOpen,
    isExportDialogOpen,
    isShortcutsDialogOpen,
    isFullscreenOpen,
    previewedAttachment,
    fileToDelete,
    setSelectedMessage,
    files.length,
  ]);

  const totalFilteredMessages = filteredMessageIndices.length;
  const shouldShowHeaderStatusRow =
    isSearching || searchFailed || hasActiveFilters || selectedCount > 0;
  const searchSummaryBaseCount =
    selectedLabel !== null && labelFilteredIndices !== null
      ? labelFilteredIndices.length
      : totalMessages;
  const messageSummaryLabel = useMemo(() => {
    const selectedLabelSuffix =
      selectedLabel !== null
        ? ` ${t("search.inLabel", { label: selectedLabel })}`
        : "";

    if (totalMessages === 0) {
      if (hasSearchQuery) {
        return `${t("search.results", { count: 0 })}${selectedLabelSuffix}`;
      }

      if (selectedLabel !== null) {
        return `${t("messages", { count: 0 })}${selectedLabelSuffix}`;
      }

      return "";
    }

    if (
      selectedCount > 0 &&
      !hasSearchQuery &&
      selectedLabel === null &&
      searchResultCount === null
    ) {
      return selectedCountLabel;
    }

    if (searchResultCount !== null) {
      const resultsLabel = t("search.results", {
        count: totalFilteredMessages,
      });
      const formattedSearchBaseCount = integerFormatter.format(
        searchSummaryBaseCount
      );

      return searchSummaryBaseCount > 0
        ? `${resultsLabel} ${t("pagination.of")} ${formattedSearchBaseCount}${selectedLabelSuffix}`
        : `${resultsLabel}${selectedLabelSuffix}`;
    }

    if (selectedLabel !== null) {
      const formattedTotalMessages = integerFormatter.format(totalMessages);
      return `${t("messages", {
        count: totalFilteredMessages,
      })} ${t("pagination.of")} ${formattedTotalMessages}${selectedLabelSuffix}`;
    }

    return t("messages", {
      count: totalMessages,
    });
  }, [
    hasSearchQuery,
    selectedCount,
    selectedCountLabel,
    searchResultCount,
    searchSummaryBaseCount,
    selectedLabel,
    t,
    totalFilteredMessages,
    totalMessages,
    integerFormatter,
  ]);

  const totalPages = Math.ceil(totalFilteredMessages / messagesPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
      return;
    }

    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [currentPage, setCurrentPage, totalPages]);

  if (files.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />

        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-md text-center">
            <Empty>
              <EmptyHeader>
                <EmptyMedia className="mb-0">
                  {store.isUploading ? (
                    <ScanText className="size-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  ) : (
                    <Mail className="size-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  )}
                </EmptyMedia>
                <EmptyTitle>
                  {store.isUploading
                    ? t("noFiles.uploading")
                    : t("noFiles.title")}
                </EmptyTitle>
                <EmptyDescription>
                  {store.isUploading
                    ? t("noFiles.uploadingDescription")
                    : t("noFiles.description")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <FileUploadInput />
              </EmptyContent>
            </Empty>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Files Sidebar */}
        <div className="w-72 border-r border-border bg-muted/20 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex flex-col justify-between items-center gap-2">
              <FileUploadInput />
            </div>

            {files.length > 0 && <Separator />}

            {files.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {t("noFiles.description")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                  {t("files.title")}
                </h3>
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={cn(
                      "group relative rounded-lg border transition-all",
                      selectedFileId === file.id
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/40 hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <div
                      onClick={() => {
                        if (editingFileId !== file.id) {
                          setSelectedFile(file.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          editingFileId !== file.id &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          setSelectedFile(file.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-colors cursor-pointer",
                        selectedFileId === file.id
                          ? "text-primary"
                          : "text-foreground"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <FileText
                          className={cn(
                            "size-4 mt-0.5 shrink-0",
                            selectedFileId === file.id
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          {editingFileId === file.id ? (
                            <div
                              className="space-y-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Input
                                value={editingFileName}
                                onChange={(e) =>
                                  setEditingFileName(e.target.value)
                                }
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => {
                                  const nextTarget =
                                    e.relatedTarget as HTMLElement | null;
                                  if (nextTarget?.dataset.renameAction) {
                                    return;
                                  }
                                  handleCommitRenameFile();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleCommitRenameFile();
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    handleCancelRenameFile();
                                  }
                                }}
                                autoFocus
                                className="h-8 text-sm"
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  data-rename-action="save"
                                  disabled={!editingFileName.trim()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCommitRenameFile();
                                  }}
                                >
                                  <Check className="size-3 mr-1" />
                                  {t("rename.save")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  data-rename-action="cancel"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelRenameFile();
                                  }}
                                >
                                  {t("rename.cancel")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p
                              className="text-sm font-medium truncate"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("messages", {
                              count: file.messageCount ?? 0,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    {editingFileId !== file.id && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRenameFile(file.id, file.name);
                          }}
                          variant="ghost"
                          size="icon"
                          className="size-8 aspect-square rounded-md hover:bg-muted"
                          aria-label={t("rename.ariaLabel")}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToDelete(file.id);
                          }}
                          variant="ghost"
                          size="icon"
                          className="size-8 aspect-square rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          aria-label={t("delete.ariaLabel")}
                        >
                          <Trash className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages List */}
        <div className="w-96 border-r border-border/60 bg-background flex flex-col">
          {/* Search */}
          <div className="border-b border-border/60 p-2.5 space-y-2 bg-muted/20">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={t("search.placeholder")}
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  className="text-sm pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors"
                    aria-label={t("search.clear")}
                  >
                    <X className="size-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {totalMessages > 0 && (
                <DropdownMenu
                  open={isActionsMenuOpen}
                  onOpenChange={setIsActionsMenuOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "relative size-7 overflow-visible shrink-0",
                        selectedCount > 0 &&
                          "text-primary bg-primary/10 hover:bg-primary/15"
                      )}
                      aria-label={actionsTriggerLabel}
                      title={actionsTriggerLabel}
                    >
                      <MoreHorizontal className="size-3.5" />
                      {selectedCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-4 min-w-5 px-1 text-[10px] leading-none">
                          {selectedCountBadgeLabel}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs">
                      {selectedMenuLabel}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                      {t("selection.sections.selection")}
                    </DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={allVisibleSelected}
                      onCheckedChange={() => {
                        handleToggleCurrentPageSelectionFromMenu();
                      }}
                      disabled={visibleMessageIndices.length === 0}
                    >
                      {togglePageSelectionLabel}{" "}
                      <span className="text-muted-foreground/80">
                        ({visibleCountLabel})
                      </span>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={allFilteredSelected}
                      onCheckedChange={() => {
                        handleToggleFilteredSelectionFromMenu();
                      }}
                      disabled={filteredMessageIndices.length === 0}
                      aria-keyshortcuts={
                        toggleFilteredSelectionAriaKeyShortcuts
                      }
                    >
                      {toggleFilteredSelectionLabel}{" "}
                      <span className="text-muted-foreground/80">
                        ({filteredCountLabel})
                      </span>
                      <DropdownMenuShortcut>
                        {toggleFilteredSelectionShortcutLabel}
                      </DropdownMenuShortcut>
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={handleClearSelectionFromMenu}
                      disabled={selectedCount === 0}
                      aria-keyshortcuts={clearSelectionAriaKeyShortcuts}
                    >
                      {t("selection.clear")}
                      <DropdownMenuShortcut>
                        {clearSelectionShortcutLabel}
                      </DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                      {t("selection.sections.filters")}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleResetFiltersFromMenu}
                      disabled={!hasActiveFilters}
                      aria-keyshortcuts={resetFiltersAriaKeyShortcuts}
                    >
                      {t("selection.resetFilters")}
                      <DropdownMenuShortcut>
                        {resetFiltersShortcutLabel}
                      </DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                      {t("selection.sections.tools")}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleOpenExportDialog}
                      disabled={selectedCount === 0}
                    >
                      {t("export.action")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleOpenShortcutsDialog}
                      aria-keyshortcuts={openShortcutsAriaKeyShortcuts}
                    >
                      {t("selection.shortcuts.openHelp")}
                      <DropdownMenuShortcut>
                        {openShortcutsShortcutLabel}
                      </DropdownMenuShortcut>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Label Filter Pills */}
            {shouldShowLabelFiltersRow && (
              <ScrollArea className="w-full">
                <div
                  className="flex gap-1.5 pb-1"
                  role="group"
                  aria-label={labelFiltersGroupLabel}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectLabelFilter(null)}
                    className={getLabelFilterChipClassName(
                      selectedLabel === null
                    )}
                    aria-pressed={selectedLabel === null}
                    aria-label={allEmailsFilterAriaLabel}
                    title={allEmailsFilterTitle}
                  >
                    {renderLabelChipContent(
                      allEmailsLabel,
                      allEmailsFilterCount,
                      selectedLabel === null
                    )}
                  </button>
                  {inlineLabelFilters.map((label) => {
                    const labelCount = getLabelMessageCount(label);
                    const isLabelActive = selectedLabel === label;

                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleSelectLabelFilter(label)}
                        className={getLabelFilterChipClassName(isLabelActive)}
                        aria-pressed={isLabelActive}
                        aria-label={getLabelFilterButtonLabel(
                          label,
                          labelDisplayCounts.get(label) ?? 0
                        )}
                        title={`${label} (${labelCount})`}
                      >
                        {renderLabelChipContent(
                          label,
                          labelCount,
                          isLabelActive
                        )}
                      </button>
                    );
                  })}
                  {overflowLabelFilters.length > 0 && (
                    <DropdownMenu
                      open={isLabelOverflowMenuOpen}
                      onOpenChange={setIsLabelOverflowMenuOpen}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={getLabelFilterChipClassName(
                            isLabelOverflowMenuOpen
                          )}
                          aria-haspopup="menu"
                          aria-expanded={isLabelOverflowMenuOpen}
                          aria-controls={labelOverflowMenuContentId}
                          aria-label={moreLabelsTriggerAriaLabel}
                          title={moreLabelsTriggerAriaLabel}
                        >
                          <span className="truncate">
                            {moreLabelsTriggerText}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        id={labelOverflowMenuContentId}
                        align="start"
                        className="max-h-72 w-56 overflow-y-auto"
                      >
                        {selectedLabel !== null && (
                          <>
                            <DropdownMenuItem
                              onClick={handleSelectOverflowAllEmails}
                              aria-label={allEmailsFilterAriaLabel}
                              title={allEmailsFilterTitle}
                            >
                              {allEmailsLabel}
                              <DropdownMenuShortcut>
                                {allEmailsFilterCount}
                              </DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {overflowLabelFilters.map((label) => (
                          <DropdownMenuCheckboxItem
                            key={label}
                            checked={selectedLabel === label}
                            onCheckedChange={(checked) =>
                              handleSelectOverflowLabelFilter(label, checked)
                            }
                            aria-label={getLabelFilterButtonLabel(
                              label,
                              labelDisplayCounts.get(label) ?? 0
                            )}
                            title={`${label} (${getLabelMessageCount(label)})`}
                          >
                            <span className="truncate">{label}</span>
                            <DropdownMenuShortcut>
                              {getLabelMessageCount(label)}
                            </DropdownMenuShortcut>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <ScrollBar orientation="horizontal" hidden />
              </ScrollArea>
            )}

            {shouldShowHeaderStatusRow && (
              <div className="flex items-center min-w-0">
                <div
                  className="min-w-0 flex-1"
                  aria-live={isSearching ? "off" : "polite"}
                  aria-atomic="true"
                >
                  {isSearching ? (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground min-w-0">
                      <Spinner
                        className="size-3"
                        label={t("search.searching")}
                      />
                      <span className="truncate">{t("search.searching")}</span>
                      <Progress
                        value={searchProgress}
                        className="h-1.5 w-20 shrink-0"
                        aria-label={t("search.searchingProgress", {
                          progress: searchProgress,
                        })}
                      />
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground/80">
                        {integerFormatter.format(searchProgress)}%
                      </span>
                    </div>
                  ) : searchFailed ? (
                    <p className="text-[11px] text-destructive font-medium truncate">
                      {t("search.error")}
                    </p>
                  ) : (
                    totalMessages > 0 && (
                      <p
                        className="text-[11px] text-muted-foreground font-medium truncate"
                        title={messageSummaryLabel}
                      >
                        {messageSummaryLabel}
                      </p>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {visibleMessageIndices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Mail className="size-10 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {hasSearchQuery
                    ? searchFailed
                      ? t("search.error")
                      : t("search.results", { count: 0 })
                    : t("search.noMessages")}
                </p>
              </div>
            ) : (
              visibleMessageIndices.map((index) => {
                const preview = getMessagePreview(index);
                // Use index for instant selection highlighting
                const isSelected = selectedMessageIndex === index;
                const isMessageChecked = selectedMessageIndices.has(index);
                const messageSubjectLabel =
                  preview?.subject || t("preview.noSubject");
                const messageSubjectForAria =
                  preview?.subject || t("preview.noSubject");
                const from = preview?.from || t("preview.unknown");
                const date = preview?.date
                  ? new Date(preview.date)
                  : new Date();
                const relativeDate = formatDistanceToNow(date, {
                  addSuffix: true,
                  locale: dateLocale,
                });

                return (
                  <div
                    key={index}
                    className={cn(
                      "w-full p-2 rounded-lg border transition-all group",
                      "hover:border-border hover:shadow-sm",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/40 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={isMessageChecked}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleMessageSelection(index, event.shiftKey);
                        }}
                        aria-label={t("selection.toggleMessageWithSubject", {
                          subject: messageSubjectForAria,
                        })}
                        className="mt-2"
                      />

                      <button
                        ref={(el) => {
                          if (el) {
                            messageRefs.current.set(index, el);
                          } else {
                            messageRefs.current.delete(index);
                          }
                        }}
                        onClick={() => handleSelectMessage(index)}
                        className="flex-1 min-w-0 text-left p-1 rounded-md cursor-pointer"
                      >
                        <div className="flex gap-3">
                          {/* Avatar */}
                          <div
                            className={cn(
                              "size-10 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0",
                              getAvatarColor(from)
                            )}
                          >
                            {getInitials(from)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p
                                className={cn(
                                  "text-sm font-semibold truncate",
                                  isSelected
                                    ? "text-primary"
                                    : "text-foreground"
                                )}
                                title={messageSubjectLabel}
                              >
                                {preview?.subject || (
                                  <span className="italic text-muted-foreground">
                                    {t("preview.noSubject")}
                                  </span>
                                )}
                              </p>
                              {preview?.size && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatSize(preview.size)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                              <div className="flex items-center gap-1 truncate">
                                <User className="size-3 shrink-0" />
                                <span className="truncate" title={from}>
                                  {from}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="size-3" />
                                <span>{relativeDate}</span>
                              </div>
                              <span className="text-muted-foreground/60">
                                {date.toLocaleString(locale, {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="border-t border-border/60 p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 disabled:opacity-50"
                  variant="outline"
                  size="sm"
                >
                  <ArrowLeftIcon className="size-4 mr-1" />
                  {t("pagination.previous")}
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t("pagination.page")}
                  </span>
                  <Badge variant="secondary" className="font-mono">
                    {currentPage}/{totalPages}
                  </Badge>
                </div>
                <Button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="h-8 px-3 disabled:opacity-50"
                  variant="outline"
                  size="sm"
                >
                  {t("pagination.next")}
                  <ArrowRightIcon className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Message Preview */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {selectedMessageData &&
          selectedMessageIndex !== null &&
          selectedMessageData.id === `msg-${selectedMessageIndex}` ? (
            <>
              {/* Message Header */}
              <div className="border-b border-border/40 bg-muted/20 shrink-0 overflow-y-auto max-h-[40vh]">
                <div className="p-6 space-y-3">
                  {/* Subject */}
                  <div>
                    <h2 className="text-lg font-semibold text-foreground line-clamp-2">
                      {selectedMessageData.subject || (
                        <span className="italic text-muted-foreground">
                          {t("preview.noSubject")}
                        </span>
                      )}
                    </h2>
                  </div>

                  {/* Compact header - always visible */}
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div
                      className={cn(
                        "size-12 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0",
                        getAvatarColor(selectedMessageData.from)
                      )}
                    >
                      {getInitials(selectedMessageData.from)}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Sender name and date */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          {(() => {
                            const primarySender =
                              formatEmailAddresses(selectedMessageData.from)
                                .filter(
                                  (address) => address.name || address.email
                                )
                                .map((address) => address.name || address.email)
                                .at(0) || t("preview.unknown");

                            return (
                              <h3
                                className="font-semibold text-base text-foreground truncate"
                                title={primarySender}
                              >
                                {primarySender}
                              </h3>
                            );
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                          {formatDate(selectedMessageData.date, "MMM d, p", {
                            locale: dateLocale,
                          })}
                        </div>
                      </div>

                      {/* Recipients and badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className="text-sm text-muted-foreground truncate min-w-0"
                          title={selectedMessageData.to || t("preview.unknown")}
                        >
                          <span className="font-medium">
                            {t("preview.to")}:{" "}
                          </span>
                          <span>
                            {(() => {
                              const toAddresses = formatEmailAddresses(
                                selectedMessageData.to
                              ).filter(
                                (address) => address.name || address.email
                              );
                              const firstRecipient =
                                toAddresses[0]?.name ||
                                toAddresses[0]?.email ||
                                t("preview.unknown");

                              if (toAddresses.length === 1) {
                                return firstRecipient;
                              } else if (toAddresses.length > 1) {
                                return `${firstRecipient}, ${t("preview.more", {
                                  count: toAddresses.length - 1,
                                })}`;
                              }
                              return t("preview.unknown");
                            })()}
                          </span>
                        </div>

                        {/* Badges and expand button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* CC indicator */}
                          {selectedMessageData.cc && (
                            <Badge variant="outline" className="text-xs h-5">
                              {t("preview.cc")}:{" "}
                              {
                                formatEmailAddresses(selectedMessageData.cc)
                                  .length
                              }
                            </Badge>
                          )}

                          {/* Attachments indicator */}
                          {selectedMessageData.attachments &&
                            selectedMessageData.attachments.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Paperclip className="size-3 text-muted-foreground" />
                                <Badge
                                  variant="secondary"
                                  className="text-xs h-5"
                                >
                                  {selectedMessageData.attachments.length}
                                </Badge>
                              </div>
                            )}

                          {/* Expand/Collapse button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setHeaderExpanded(!headerExpanded)}
                            className="h-6 px-2 text-xs -mr-2"
                          >
                            {headerExpanded ? (
                              <>
                                <ChevronUp className="size-3.5 mr-1" />
                                {t("preview.less")}
                              </>
                            ) : (
                              <>
                                <ChevronDown className="size-3.5 mr-1" />
                                {t("preview.details")}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {headerExpanded && (
                    <div className="pt-3 border-t border-border/40">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                              <User className="size-3" />
                              {t("preview.from")}
                            </label>
                            <div className="space-y-1.5">
                              {formatEmailAddresses(
                                selectedMessageData.from
                              ).map((addr, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-col gap-0.5"
                                >
                                  {addr.name ? (
                                    <>
                                      <span className="text-sm font-medium text-foreground">
                                        {addr.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {addr.email}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-sm text-foreground">
                                      {addr.email || t("preview.unknown")}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                              <Mail className="size-3" />
                              {t("preview.to")}
                              {formatEmailAddresses(selectedMessageData.to)
                                .length > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  {
                                    formatEmailAddresses(selectedMessageData.to)
                                      .length
                                  }
                                </Badge>
                              )}
                            </label>
                            <RecipientList
                              addresses={formatEmailAddresses(
                                selectedMessageData.to
                              )}
                              maxVisible={2}
                              type="to"
                            />
                          </div>
                          {selectedMessageData.cc && (
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                {t("preview.cc")}
                                {formatEmailAddresses(selectedMessageData.cc)
                                  .length > 1 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {
                                      formatEmailAddresses(
                                        selectedMessageData.cc
                                      ).length
                                    }
                                  </Badge>
                                )}
                              </label>
                              <RecipientList
                                addresses={formatEmailAddresses(
                                  selectedMessageData.cc
                                )}
                                maxVisible={2}
                                type="cc"
                              />
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                              <Calendar className="size-3" />
                              {t("preview.date")}
                            </label>
                            <p className="text-sm text-foreground">
                              {formatDate(selectedMessageData.date, "PPP p", {
                                locale: dateLocale,
                              })}
                            </p>
                          </div>
                          {selectedMessageData.attachments &&
                            selectedMessageData.attachments.length > 0 && (
                              <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                  <Paperclip className="size-3" />
                                  {t("preview.attachments")}
                                </label>
                                <p className="text-sm text-foreground">
                                  {t("preview.attachmentCount", {
                                    count:
                                      selectedMessageData.attachments.length,
                                  })}
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Message Tabs */}
              <Tabs
                value={effectiveTab}
                onValueChange={setTab}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <TabsList className="w-full rounded-none border-b shrink-0">
                  {hasBody ? (
                    <TabsTrigger value="body">{t("preview.body")}</TabsTrigger>
                  ) : null}
                  {hasAttachments && (
                    <TabsTrigger value="attachments">
                      {t("preview.attachments")} (
                      {selectedMessageData.attachments?.length})
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="headers">
                    {t("preview.headers")}
                  </TabsTrigger>
                </TabsList>

                {/* Body Tab */}
                {selectedMessageData.htmlBody || selectedMessageData.body ? (
                  <TabsContent
                    value="body"
                    className="flex-1 flex flex-col overflow-hidden m-0 p-0 data-[state=active]:flex"
                  >
                    {selectedMessageData.htmlBody ? (
                      <Tabs
                        defaultValue="html"
                        value={bodyTab}
                        onValueChange={(value) =>
                          setBodyTab(value as "html" | "text")
                        }
                        className="flex-1 flex flex-col overflow-hidden min-h-0 gap-0"
                      >
                        <div className="shrink-0 flex items-center justify-between px-6 pt-2 pb-4 border-b">
                          <TabsList className="p-0">
                            <TabsTrigger value="html" className="text-xs">
                              <CodeXml />
                              {t("preview.html")}
                            </TabsTrigger>
                            <TabsTrigger value="text" className="text-xs">
                              <TextInitial />
                              {t("preview.plainText")}
                            </TabsTrigger>
                          </TabsList>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFullscreenOpen(true)}
                            aria-label={t("preview.fullscreen")}
                          >
                            <Maximize2 />
                          </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          <TabsContent value="html" className="p-6 pb-12">
                            <div className="bg-white rounded-lg p-4 border border-border/40">
                              <HtmlRenderer
                                html={selectedMessageData.htmlBody}
                                className="w-full"
                                attachments={selectedMessageData.attachments}
                              />
                            </div>
                          </TabsContent>
                          <TabsContent value="text" className="p-6 pb-12">
                            <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                              <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                                {selectedMessageData.body}
                              </pre>
                            </div>
                          </TabsContent>
                        </div>
                      </Tabs>
                    ) : (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="shrink-0 flex items-center justify-end px-6 pt-2 pb-4 border-b">
                          <Button
                            variant="ghost"
                            onClick={() => setIsFullscreenOpen(true)}
                            aria-label={t("preview.fullscreen")}
                          >
                            <Maximize2 />
                          </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 pb-12">
                          <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                            <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                              {selectedMessageData.body}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                ) : null}

                {/* Headers Tab */}
                <TabsContent
                  value="headers"
                  className="flex-1 overflow-y-auto min-h-0 p-6 pb-12"
                >
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                    <pre className="text-xs font-mono text-foreground overflow-x-auto">
                      {JSON.stringify(selectedMessageData.headers, null, 2)}
                    </pre>
                  </div>
                </TabsContent>

                {/* Attachments Tab */}
                {selectedMessageData.attachments &&
                selectedMessageData.attachments.length > 0 ? (
                  <TabsContent
                    value="attachments"
                    className="flex-1 overflow-y-auto min-h-0 p-6 pb-12"
                  >
                    <div className="space-y-3">
                      {selectedMessageData.attachments.map(
                        (att: EmailAttachment) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between p-4 gap-4 rounded-lg border border-border/40 bg-card hover:bg-muted/50 transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {PREVIEWABLE_MIME_TYPES.includes(att.mimeType) ? (
                                <Image
                                  src={`data:${att.mimeType};base64,${att.data}`}
                                  alt={att.filename}
                                  width={100}
                                  height={100}
                                  className="size-16 object-scale-down rounded-md border border-border bg-background"
                                  loading="lazy"
                                  unoptimized
                                />
                              ) : (
                                <div className="size-16 flex items-center justify-center rounded-md border border-border bg-muted">
                                  <FileText className="size-8 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p
                                  className="font-medium truncate text-sm mb-1"
                                  title={att.filename}
                                >
                                  {att.filename}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-xs">
                                    {att.mimeType
                                      .split("/")[1]
                                      ?.toUpperCase() || att.mimeType}
                                  </Badge>
                                  <span>•</span>
                                  <span>{formatSize(att.size)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewedAttachment(att)}
                                aria-label={t("preview.preview")}
                              >
                                <Eye className="size-4 mr-2" />
                                {t("preview.preview")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadAttachment(att)}
                              >
                                <Download className="size-4 mr-2" />
                                {t("preview.download")}
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </TabsContent>
                ) : null}
              </Tabs>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              {loadingMessage || selectedMessageIndex !== null ? (
                <>
                  <Spinner
                    className="size-16 mx-auto mb-4 text-primary"
                    label={t("preview.loading")}
                  />
                  <p className="text-sm font-medium text-foreground mb-1">
                    {t("preview.loading")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("preview.loadingMessageContent")}
                  </p>
                </>
              ) : (
                <>
                  <div className="size-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Mail className="size-10 text-muted-foreground opacity-50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {t("preview.selectMessage")}
                  </h3>
                  <div className="text-sm text-muted-foreground max-w-sm">
                    {t("preview.useArrows.use")}{" "}
                    <KbdGroup>
                      <Kbd>↑</Kbd>
                      <span>{t("preview.useArrows.or")}</span>
                      <Kbd>↓</Kbd>
                    </KbdGroup>{" "}
                    {t("preview.useArrows.toNavigate")}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export Dialog */}
      <Dialog
        open={isExportDialogOpen}
        onOpenChange={(open) => {
          if (!isExporting) {
            setIsExportDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!isExporting}>
          <DialogHeader>
            <DialogTitle>{t("export.title")}</DialogTitle>
            <DialogDescription>
              {t("export.description", { count: selectedCount })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t("export.formatLabel")}</Label>
              <RadioGroup
                value={exportFormat}
                onValueChange={(value) =>
                  setExportFormat(value as ExportFormat)
                }
                disabled={isExporting}
                className="grid grid-cols-3 gap-2"
              >
                <div className="flex items-center space-x-2 rounded-md border p-2">
                  <RadioGroupItem value="mbox" id="export-mbox" />
                  <Label htmlFor="export-mbox" className="cursor-pointer">
                    {t("export.formats.mbox")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-2">
                  <RadioGroupItem value="txt" id="export-txt" />
                  <Label htmlFor="export-txt" className="cursor-pointer">
                    {t("export.formats.txt")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-md border p-2">
                  <RadioGroupItem value="html" id="export-html" />
                  <Label htmlFor="export-html" className="cursor-pointer">
                    {t("export.formats.html")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">
                  {t("export.includeAttachments")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("export.includeAttachmentsHint")}
                </p>
              </div>
              <Checkbox
                checked={includeAttachmentsInExport}
                onCheckedChange={(checked) =>
                  setIncludeAttachmentsInExport(checked === true)
                }
                aria-label={t("export.includeAttachments")}
                disabled={isExporting}
              />
            </div>

            {isExporting && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t("export.progress", { progress: exportProgress })}
                </p>
                <Progress value={exportProgress} className="h-2" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={
                isExporting
                  ? handleCancelExport
                  : () => setIsExportDialogOpen(false)
              }
            >
              {isExporting ? t("export.cancelInProgress") : t("export.cancel")}
            </Button>
            <Button
              onClick={handleExportSelectedMessages}
              disabled={isExporting || selectedCount === 0}
            >
              {isExporting ? (
                <>
                  <Spinner
                    className="size-4 mr-2"
                    label={t("export.exporting")}
                  />
                  {t("export.exporting")}
                </>
              ) : (
                <>
                  <Download className="size-4 mr-2" />
                  {t("export.confirm")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selection Shortcuts Dialog */}
      <Dialog
        open={isShortcutsDialogOpen}
        onOpenChange={setIsShortcutsDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("selection.shortcuts.title")}</DialogTitle>
            <DialogDescription>
              {t("selection.shortcuts.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KbdGroup>
                <Kbd>{openShortcutsShortcutLabel}</Kbd>
              </KbdGroup>
              <span>{t("selection.shortcuts.openDialog")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KbdGroup>
                <Kbd>{shortcutModifierLabel}</Kbd>
                <Kbd>A</Kbd>
              </KbdGroup>
              <span>{t("selection.shortcuts.select")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KbdGroup>
                <Kbd>Shift</Kbd>
                <Kbd>{shortcutModifierLabel}</Kbd>
                <Kbd>A</Kbd>
              </KbdGroup>
              <span>{t("selection.shortcuts.clear")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KbdGroup>
                <Kbd>Shift</Kbd>
                <Kbd>Esc</Kbd>
              </KbdGroup>
              <span>{t("selection.shortcuts.resetFilters")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <KbdGroup>
                <Kbd>Shift</Kbd>
                <Kbd>{t("selection.shortcuts.clickKey")}</Kbd>
              </KbdGroup>
              <span>{t("selection.shortcuts.range")}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={fileToDelete !== null}
        onOpenChange={(open) => !open && setFileToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {fileToDelete && (
                <>
                  {t("delete.description")}
                  <br />
                  <br />
                  <span className="font-medium text-foreground">
                    {files.find((f) => f.id === fileToDelete)?.name}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (fileToDelete) {
                  handleDeleteFile(fileToDelete);
                  setFileToDelete(null);
                }
              }}
            >
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Body Dialog */}
      <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
        <DialogContent className="max-w-[calc(100dvw-8rem)] max-h-[calc(100dvh-8rem)] w-full h-full sm:max-w-[calc(100dvw-8rem)] flex flex-col gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center justify-between h-10">
              <span>
                {selectedMessageData?.subject || t("preview.noSubject")}
              </span>
              {selectedMessageData?.htmlBody && (
                <Tabs
                  value={bodyTab}
                  onValueChange={(value) =>
                    setBodyTab(value as "html" | "text")
                  }
                >
                  <TabsList className="p-0 ml-4">
                    <TabsTrigger value="html" className="text-xs">
                      <CodeXml />
                      {t("preview.html")}
                    </TabsTrigger>
                    <TabsTrigger value="text" className="text-xs">
                      <TextInitial />
                      {t("preview.plainText")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {selectedMessageData?.htmlBody ? (
              bodyTab === "html" ? (
                <div className="bg-white rounded-lg p-4 border border-border/40">
                  <HtmlRenderer
                    html={selectedMessageData.htmlBody}
                    className="w-full"
                    attachments={selectedMessageData.attachments}
                  />
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                  <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                    {selectedMessageData.body}
                  </pre>
                </div>
              )
            ) : selectedMessageData?.body ? (
              <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                  {selectedMessageData.body}
                </pre>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Dialog */}
      <Dialog
        open={!!previewedAttachment}
        onOpenChange={(open) => !open && setPreviewedAttachment(null)}
      >
        <DialogContent className="max-w-[calc(100dvw-8rem)] max-h-[calc(100dvh-8rem)] w-full h-full sm:max-w-[calc(100dvw-8rem)] flex flex-col gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span
                className="truncate flex-1 mr-4"
                title={previewedAttachment?.filename}
              >
                {previewedAttachment?.filename}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {previewedAttachment && (
                  <>
                    <Badge
                      variant="secondary"
                      className="text-xs h-8 border border-foreground/5"
                    >
                      {previewedAttachment.mimeType
                        .split("/")[1]
                        ?.toUpperCase() || previewedAttachment.mimeType}
                    </Badge>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (previewedAttachment) {
                          downloadAttachment(previewedAttachment);
                        }
                      }}
                    >
                      <Download className="size-4 mr-2" />
                      {t("preview.download")}
                      <span className="text-xs text-muted-foreground">
                        ({formatSize(previewedAttachment.size)})
                      </span>
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {previewedAttachment && (
              <>
                {isImageType(previewedAttachment.mimeType) ? (
                  <div className="flex items-center justify-center w-full h-full min-h-[400px]">
                    {previewObjectUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewObjectUrl}
                        alt={previewedAttachment.filename}
                        className="max-w-full max-h-[calc(100vh-16rem)] object-contain rounded-lg border border-border/40 bg-background"
                      />
                    ) : (
                      <div className="flex items-center justify-center">
                        <Spinner
                          className="size-8"
                          label={t("preview.loading")}
                        />
                      </div>
                    )}
                  </div>
                ) : isPdfType(previewedAttachment.mimeType) ? (
                  <div className="w-full h-full min-h-[600px]">
                    {previewObjectUrl ? (
                      <iframe
                        src={previewObjectUrl}
                        className="w-full h-full border border-border/40 rounded-lg"
                        title={previewedAttachment.filename}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Spinner
                          className="size-8"
                          label={t("preview.loading")}
                        />
                      </div>
                    )}
                  </div>
                ) : isTextType(previewedAttachment.mimeType) ? (
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/40">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-foreground overflow-x-auto">
                      {(() => {
                        try {
                          if (previewedAttachment.encoding === "base64") {
                            const binaryData = atob(
                              previewedAttachment.data.replace(/\s/g, "")
                            );
                            const bytes = new Uint8Array(binaryData.length);
                            for (let i = 0; i < binaryData.length; i++) {
                              bytes[i] = binaryData.charCodeAt(i);
                            }
                            return new TextDecoder("utf-8", {
                              fatal: false,
                            }).decode(bytes);
                          }
                          return previewedAttachment.data;
                        } catch (err) {
                          console.error("Failed to decode text:", err);
                          return t("preview.attachmentPreviewError");
                        }
                      })()}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
                    <FileText className="size-16 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium mb-2">
                        {t("preview.attachmentPreviewNotAvailable")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("preview.attachmentPreviewNotAvailableDescription")}
                      </p>
                    </div>
                    <Button
                      onClick={() => downloadAttachment(previewedAttachment)}
                    >
                      <Download className="size-4 mr-2" />
                      {t("preview.download")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
