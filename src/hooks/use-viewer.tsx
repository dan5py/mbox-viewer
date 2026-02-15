"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import useMboxStore from "~/stores/mbox-store";
import { enUS } from "date-fns/locale/en-US";
import { it } from "date-fns/locale/it";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { EmailAttachment, EmailMessage } from "~/types/files";
import { base64ToBlob } from "~/lib/email-utils";
import {
  dropdownMenuFocusableItemSelector,
  isSelectionWithinElement,
  shouldIgnoreGlobalShortcutTarget,
} from "~/lib/keyboard-utils";
import { ExportFormat, exportMessages } from "~/lib/message-export";
import { cn } from "~/lib/utils";
import { useDebounce } from "~/hooks/use-debounce";
import { useIsMobile } from "~/hooks/use-mobile";

export function useViewer() {
  const t = useTranslations("Viewer");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const dateLocale = locale === "it" ? it : enUS;
  const labelOverflowMenuContentId = useId();

  // ── Message state ──────────────────────────────────────────────────
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<
    number | null
  >(null);
  const [selectedMessageData, setSelectedMessageData] =
    useState<EmailMessage | null>(null);
  const loadingAbortRef = useRef<AbortController | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  // ── Search state ───────────────────────────────────────────────────
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<number[] | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);

  // ── Selection state ────────────────────────────────────────────────
  const [selectedMessageIndices, setSelectedMessageIndices] = useState<
    Set<number>
  >(new Set());

  // ── UI state ───────────────────────────────────────────────────────
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isLabelOverflowMenuOpen, setIsLabelOverflowMenuOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [isMobileFilesSheetOpen, setIsMobileFilesSheetOpen] = useState(false);
  const [mobileActivePane, setMobileActivePane] = useState<
    "messages" | "preview"
  >("messages");
  const [isApplePlatform, setIsApplePlatform] = useState<boolean | null>(null);

  // ── Export state ───────────────────────────────────────────────────
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mbox");
  const [includeAttachmentsInExport, setIncludeAttachmentsInExport] =
    useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // ── Preview state ──────────────────────────────────────────────────
  const [tab, setTab] = useState("body");
  const [expandedRecipients, setExpandedRecipients] = useState<{
    to: boolean;
    cc: boolean;
  }>({ to: false, cc: false });
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [bodyTab, setBodyTab] = useState<"html" | "text">("html");
  const [previewedAttachment, setPreviewedAttachment] =
    useState<EmailAttachment | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  // ── File editing state ─────────────────────────────────────────────
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");

  // ── Refs ───────────────────────────────────────────────────────────
  const searchWorker = useRef<Worker | null>(null);
  const viewerPageRootRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const labelFiltersGroupRef = useRef<HTMLDivElement | null>(null);
  const lastNavTimeRef = useRef<number>(0);
  const lastSelectionAnchorRef = useRef<number | null>(null);
  const previousSearchQueryRef = useRef("");

  // ── Store ──────────────────────────────────────────────────────────
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
    removeFile,
    loadMessage,
  } = useMboxStore();

  // ── Derived values ─────────────────────────────────────────────────
  const currentFile = files.find((f) => f.id === selectedFileId);
  const totalMessages = currentFile?.messageCount || 0;
  const searchResultCount = searchResults?.length ?? null;

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

  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const normalizedSearchQuery = debouncedSearchQuery.trim();
  const hasSearchQuery = searchQuery.trim().length > 0;

  const shortcutModifierLabel =
    isApplePlatform === null ? "Ctrl/Cmd" : isApplePlatform ? "⌘" : "Ctrl";

  // ── Label filtering ────────────────────────────────────────────────
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

  const allLabels = useMemo(() => {
    return Array.from(labelToMessageIndices.keys()).sort(
      labelSortCollator.compare
    );
  }, [labelSortCollator, labelToMessageIndices]);

  const labelFilteredIndices = useMemo(() => {
    if (selectedLabel === null) {
      return null;
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

  // ── Filtering & pagination ─────────────────────────────────────────
  const filteredMessageIndices = useMemo(() => {
    if (!(files.length > 0 && currentFile)) return [];

    let baseIndices: number[] | null = null;
    if (labelFilteredIndices !== null) {
      baseIndices = labelFilteredIndices;
    } else {
      baseIndices = Array.from({ length: totalMessages }, (_, i) => i);
    }

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

  const totalFilteredMessages = filteredMessageIndices.length;
  const totalPages = Math.ceil(totalFilteredMessages / messagesPerPage);

  const selectedCount = selectedMessageIndices.size;
  const integerFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale]
  );

  // ── Computed labels for UI ─────────────────────────────────────────
  const selectedCountLabel = t("selection.selectedCount", {
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
  const labelFilterControlsCount =
    1 + inlineLabelFilters.length + (overflowLabelFilters.length > 0 ? 1 : 0);
  const labelFilterOptionsTotalCount = 1 + labelFiltersForLayout.length;
  const labelFiltersGroupLabel =
    selectedLabel !== null
      ? t("search.labelFiltersSummaryActive", {
          controlsCount: labelFilterControlsCount,
          optionsCount: labelFilterOptionsTotalCount,
          label: selectedLabel,
        })
      : t("search.labelFiltersSummary", {
          controlsCount: labelFilterControlsCount,
          optionsCount: labelFilterOptionsTotalCount,
        });
  const toggleFilteredSelectionShortcutLabel = `${shortcutModifierLabel}+A`;
  const clearSelectionShortcutLabel = `Shift+${shortcutModifierLabel}+A`;
  const resetFiltersShortcutLabel = "Shift+Esc";
  const clearPreviewShortcutLabel = "Esc";
  const openShortcutsShortcutLabel = "? / F1 / Help";
  const toggleFilteredSelectionAriaKeyShortcuts = "Control+A Meta+A";
  const clearSelectionAriaKeyShortcuts = "Shift+Control+A Shift+Meta+A";
  const resetFiltersAriaKeyShortcuts = "Shift+Escape";
  const openShortcutsAriaKeyShortcuts = "Shift+Slash F1 Help";
  const overflowMenuItemsCount =
    overflowLabelFilters.length + (selectedLabel !== null ? 1 : 0);
  const moreLabelsTriggerText = t("search.moreLabels", {
    count: overflowLabelFilters.length,
  });
  const moreLabelsTriggerAriaLabel =
    selectedLabel !== null
      ? t("search.moreLabelsAriaActive", {
          count: overflowLabelFilters.length,
          label: selectedLabel,
        })
      : t("search.moreLabelsAria", {
          count: overflowLabelFilters.length,
        });
  const moreLabelsMenuAriaLabel =
    selectedLabel !== null
      ? t("search.moreLabelsMenuLabelActive", {
          count: overflowMenuItemsCount,
          label: selectedLabel,
        })
      : t("search.moreLabelsMenuLabel", {
          count: overflowMenuItemsCount,
        });
  const shouldShowLabelFiltersRow =
    allLabels.length > 0 &&
    (selectedLabel !== null || labelFiltersForLayout.length > 0);
  const getLabelMessageCount = useCallback(
    (label: string) =>
      integerFormatter.format(labelDisplayCounts.get(label) ?? 0),
    [integerFormatter, labelDisplayCounts]
  );
  const renderLabelChipContent = useCallback(
    (label: string, count: string, isActive: boolean) =>
      isActive ? (
        <span className="inline-flex max-w-full items-center gap-1">
          <span className="truncate">{label}</span>
          <span className="shrink-0 tabular-nums">({count})</span>
        </span>
      ) : (
        <span className="truncate">{label}</span>
      ),
    []
  );
  const getLabelFilterButtonLabel = useCallback(
    (label: string, count: number) =>
      t("search.labelWithCount", {
        label,
        count,
      }),
    [t]
  );
  const allEmailsFilterAriaLabel = getLabelFilterButtonLabel(
    allEmailsLabel,
    allEmailsFilterCountValue
  );
  const allEmailsFilterTitle = `${allEmailsLabel} (${allEmailsFilterCount})`;
  const labelFilterChipBaseClassName =
    "inline-flex max-w-44 items-center rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
  const getLabelFilterChipClassName = useCallback(
    (isActive: boolean) =>
      cn(
        labelFilterChipBaseClassName,
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      ),
    [labelFilterChipBaseClassName]
  );

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

  // ── Effects ────────────────────────────────────────────────────────

  // Search worker setup
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

  // Platform detection
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

  // Mobile pane reset
  useEffect(() => {
    if (!isMobile) {
      setIsMobileFilesSheetOpen(false);
      setMobileActivePane("messages");
    }
  }, [isMobile]);

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

  // Trigger search in worker
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

      searchWorker.current?.postMessage({
        type: "ABORT",
      });

      setIsSearching(true);
      setSearchProgress(0);
      setSearchFailed(false);
      setCurrentPage(1);

      searchWorker.current?.postMessage({
        type: "SEARCH",
        payload: {
          file: currentFile.fileReader.file,
          boundaries: currentFile.messageBoundaries,
          query: normalizedSearchQuery,
        },
      });
    } else if (!normalizedSearchQuery) {
      searchWorker.current?.postMessage({
        type: "ABORT",
      });
      setIsSearching(false);
      setSearchProgress(0);
      setSearchFailed(false);
      setSearchResults(null);
    }
  }, [normalizedSearchQuery, searchWorker, currentFile, setCurrentPage]);

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
    setIsMobileFilesSheetOpen(false);
    setExportProgress(0);
    setEditingFileId(null);
    setEditingFileName("");
  }, [selectedFileId]);

  // Cleanup export abort on unmount
  useEffect(() => {
    return () => {
      exportAbortRef.current?.abort();
    };
  }, []);

  // Label filter validity
  useEffect(() => {
    if (selectedLabel !== null && !labelToMessageIndices.has(selectedLabel)) {
      setSelectedLabel(null);
    }
  }, [labelToMessageIndices, selectedLabel, setSelectedLabel]);

  // Close overflow menu when no overflow labels
  useEffect(() => {
    if (overflowLabelFilters.length === 0 && isLabelOverflowMenuOpen) {
      setIsLabelOverflowMenuOpen(false);
    }
  }, [overflowLabelFilters.length, isLabelOverflowMenuOpen]);

  // Close overflow menu on search change
  useEffect(() => {
    if (
      previousSearchQueryRef.current !== searchQuery &&
      isLabelOverflowMenuOpen
    ) {
      setIsLabelOverflowMenuOpen(false);
    }
    previousSearchQueryRef.current = searchQuery;
  }, [isLabelOverflowMenuOpen, searchQuery]);

  // Page validation
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
      return;
    }

    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [currentPage, setCurrentPage, totalPages]);

  // Attachment preview object URL
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

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewedAttachment]);

  // ── Callbacks ──────────────────────────────────────────────────────

  // Message selection
  const handleSelectMessage = useCallback(
    (index: number) => {
      if (!currentFile?.id) return;

      if (selectedMessageIndex === index) {
        setSelectedMessageIndex(null);
        setSelectedMessage(null);
        setSelectedMessageData(null);
        return;
      }

      if (loadingAbortRef.current) {
        loadingAbortRef.current.abort();
      }

      setExpandedRecipients({ to: false, cc: false });
      setHeaderExpanded(false);

      setSelectedMessageIndex(index);
      setSelectedMessage(`msg-${index}`);
      if (isMobile) {
        setMobileActivePane("preview");
      }

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
    [currentFile?.id, isMobile, selectedMessageIndex, setSelectedMessage]
  );

  // Debounced message loading
  const debouncedSelectedIndex = useDebounce(selectedMessageIndex, 150);

  useEffect(() => {
    if (debouncedSelectedIndex === null || !currentFile?.id) {
      return;
    }

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

  // File management
  const handleDeleteFile = useCallback(
    (fileId: string) => {
      const isSelectedFile = selectedFileId === fileId;

      if (isSelectedFile && searchWorker.current) {
        searchWorker.current.postMessage({ type: "ABORT" });
        setIsSearching(false);
        setSearchProgress(0);
        setSearchFailed(false);
        setSearchResults(null);
      }

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
    },
    [selectedFileId, editingFileId, removeFile]
  );

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

  const handleSelectFile = useCallback(
    (fileId: string) => {
      setSelectedFile(fileId);
      if (isMobile) {
        setIsMobileFilesSheetOpen(false);
        setMobileActivePane("messages");
      }
    },
    [isMobile, setSelectedFile]
  );

  // Label filtering
  const handleSelectLabelFilter = useCallback(
    (label: string | null) => {
      if (label === null) {
        setSelectedLabel(null);
      } else {
        setSelectedLabel(selectedLabel === label ? null : label);
      }
      setIsLabelOverflowMenuOpen(false);
    },
    [selectedLabel, setSelectedLabel]
  );

  const handleSelectOverflowLabelFilter = useCallback(
    (label: string, checked: boolean | "indeterminate") => {
      if (checked === true) {
        handleSelectLabelFilter(label);
      } else if (selectedLabel === label) {
        handleSelectLabelFilter(null);
      } else {
        setIsLabelOverflowMenuOpen(false);
      }
    },
    [handleSelectLabelFilter, selectedLabel]
  );

  const handleSelectOverflowAllEmails = useCallback(() => {
    handleSelectLabelFilter(null);
  }, [handleSelectLabelFilter]);

  const handleDropdownMenuBoundaryKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (event.key !== "Home" && event.key !== "End") {
        return;
      }

      const menuItems = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          dropdownMenuFocusableItemSelector
        )
      );
      if (menuItems.length === 0) {
        return;
      }

      event.preventDefault();
      if (event.key === "Home") {
        menuItems[0]?.focus();
      } else {
        menuItems[menuItems.length - 1]?.focus();
      }
    },
    []
  );

  const handleLabelFiltersGroupKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }

      if (!(event.target instanceof HTMLButtonElement)) {
        return;
      }

      if (event.target.dataset.labelFilterChip !== "true") {
        return;
      }

      const groupElement = labelFiltersGroupRef.current;
      if (!groupElement) {
        return;
      }

      const chipButtons = Array.from(
        groupElement.querySelectorAll<HTMLButtonElement>(
          'button[data-label-filter-chip="true"]:not([disabled])'
        )
      );

      const currentIndex = chipButtons.indexOf(event.target);
      if (currentIndex === -1) {
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        chipButtons[0]?.focus();
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        chipButtons[chipButtons.length - 1]?.focus();
        return;
      }

      if (chipButtons.length <= 1) {
        return;
      }

      event.preventDefault();

      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        (currentIndex + delta + chipButtons.length) % chipButtons.length;
      chipButtons[nextIndex]?.focus();
    },
    []
  );

  // Multi-selection
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

  // Search
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

  // Menu actions
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

  // Export
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

  // Recipient expansion toggle
  const handleToggleRecipientExpanded = useCallback((type: "to" | "cc") => {
    setExpandedRecipients((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    if (files.length === 0) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) {
        return;
      }

      if (e.isComposing || e.key === "Process") {
        return;
      }

      if (
        isActionsMenuOpen ||
        isLabelOverflowMenuOpen ||
        isExportDialogOpen ||
        isShortcutsDialogOpen ||
        isMobileFilesSheetOpen ||
        isFullscreenOpen ||
        !!previewedAttachment ||
        fileToDelete !== null
      ) {
        return;
      }

      const activeElement = document.activeElement;
      if (
        shouldIgnoreGlobalShortcutTarget(e.target) ||
        (activeElement !== e.target &&
          shouldIgnoreGlobalShortcutTarget(activeElement))
      ) {
        return;
      }

      const isSelectAllShortcut =
        (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "a";
      const hasActiveViewerTextSelection = isSelectAllShortcut
        ? isSelectionWithinElement(viewerPageRootRef.current)
        : false;
      const isOpenShortcutsHelpShortcut =
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (((e.key === "F1" || e.key === "Help") && !e.shiftKey) ||
          e.key === "?" ||
          (e.shiftKey && (e.key === "/" || e.code === "Slash")));
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
      const hasPreviewSelection =
        selectedMessageIndex !== null || selectedMessageData !== null;
      const shouldIgnoreRepeatShortcut =
        e.repeat &&
        (isSelectAllShortcut ||
          isOpenShortcutsHelpShortcut ||
          isResetFiltersShortcut ||
          isClearPreviewSelectionShortcut);

      if (shouldIgnoreRepeatShortcut) {
        return;
      }

      if (isSelectAllShortcut && hasActiveViewerTextSelection) {
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
        const currentPosInList = visibleMessageIndices.findIndex(
          (idx) => idx === selectedMessageIndex
        );
        if (currentPosInList < visibleMessageIndices.length - 1) {
          handleSelectMessage(visibleMessageIndices[currentPosInList + 1]);
        } else if (
          currentPosInList === -1 &&
          visibleMessageIndices.length > 0
        ) {
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
          handleSelectMessage(
            visibleMessageIndices[visibleMessageIndices.length - 1]
          );
        }
      } else if (isClearPreviewSelectionShortcut) {
        if (!hasPreviewSelection) {
          return;
        }

        e.preventDefault();
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
    isMobileFilesSheetOpen,
    isFullscreenOpen,
    previewedAttachment,
    fileToDelete,
    setSelectedMessage,
    selectedMessageData,
    files.length,
  ]);

  // ── Return ─────────────────────────────────────────────────────────
  return {
    // Core
    t,
    locale,
    dateLocale,
    isMobile,
    store,
    currentFile,

    // Refs
    viewerPageRootRef,
    messageRefs,
    labelFiltersGroupRef,

    // Store state
    files,
    selectedFileId,
    searchQuery,
    selectedLabel,
    currentPage,
    messagesPerPage,
    setSelectedFile,
    setCurrentPage,

    // Message
    selectedMessageIndex,
    selectedMessageData,
    loadingMessage,
    handleSelectMessage,

    // Search
    isSearching,
    searchProgress,
    searchFailed,
    hasSearchQuery,
    handleSearchInputChange,
    handleClearSearch,

    // Labels
    allLabels,
    inlineLabelFilters,
    overflowLabelFilters,
    labelDisplayCounts,
    shouldShowLabelFiltersRow,
    labelOverflowMenuContentId,
    labelFiltersGroupLabel,
    handleSelectLabelFilter,
    handleSelectOverflowLabelFilter,
    handleSelectOverflowAllEmails,
    handleLabelFiltersGroupKeyDown,
    handleDropdownMenuBoundaryKeyDown,
    isLabelOverflowMenuOpen,
    setIsLabelOverflowMenuOpen,
    allEmailsLabel,
    allEmailsFilterCount,
    allEmailsFilterAriaLabel,
    allEmailsFilterTitle,
    getLabelFilterChipClassName,
    getLabelMessageCount,
    getLabelFilterButtonLabel,
    renderLabelChipContent,
    moreLabelsTriggerText,
    moreLabelsTriggerAriaLabel,
    moreLabelsMenuAriaLabel,

    // Multi-selection
    selectedMessageIndices,
    selectedCount,
    handleToggleMessageSelection,
    handleToggleCurrentPageSelection,
    handleToggleFilteredSelection,
    handleClearSelection,

    // Filtering & pagination
    filteredMessageIndices,
    visibleMessageIndices,
    totalMessages,
    totalFilteredMessages,
    totalPages,
    integerFormatter,

    // Computed labels
    selectedCountLabel,
    actionsTriggerLabel,
    selectedCountBadgeLabel,
    visibleCountLabel,
    filteredCountLabel,
    togglePageSelectionLabel,
    toggleFilteredSelectionLabel,
    toggleFilteredSelectionShortcutLabel,
    clearSelectionShortcutLabel,
    resetFiltersShortcutLabel,
    clearPreviewShortcutLabel,
    openShortcutsShortcutLabel,
    toggleFilteredSelectionAriaKeyShortcuts,
    clearSelectionAriaKeyShortcuts,
    resetFiltersAriaKeyShortcuts,
    openShortcutsAriaKeyShortcuts,
    hasActiveFilters,
    allVisibleSelected,
    allFilteredSelected,
    shouldShowHeaderStatusRow,
    messageSummaryLabel,

    // File management
    editingFileId,
    editingFileName,
    setEditingFileName,
    fileToDelete,
    setFileToDelete,
    handleDeleteFile,
    handleStartRenameFile,
    handleCancelRenameFile,
    handleCommitRenameFile,
    handleSelectFile,

    // Actions menu
    isActionsMenuOpen,
    setIsActionsMenuOpen,
    handleToggleCurrentPageSelectionFromMenu,
    handleToggleFilteredSelectionFromMenu,
    handleClearSelectionFromMenu,
    handleResetFiltersFromMenu,
    handleOpenExportDialog,
    handleOpenShortcutsDialog,

    // Export
    isExportDialogOpen,
    setIsExportDialogOpen,
    exportFormat,
    setExportFormat,
    includeAttachmentsInExport,
    setIncludeAttachmentsInExport,
    isExporting,
    exportProgress,
    handleExportSelectedMessages,
    handleCancelExport,

    // Shortcuts dialog
    isShortcutsDialogOpen,
    setIsShortcutsDialogOpen,
    shortcutModifierLabel,

    // Mobile
    mobileActivePane,
    setMobileActivePane,
    isMobileFilesSheetOpen,
    setIsMobileFilesSheetOpen,

    // Preview state
    effectiveTab,
    hasBody,
    hasAttachments,
    tab,
    setTab,
    bodyTab,
    setBodyTab,
    headerExpanded,
    setHeaderExpanded,
    expandedRecipients,
    handleToggleRecipientExpanded,
    isFullscreenOpen,
    setIsFullscreenOpen,
    previewedAttachment,
    setPreviewedAttachment,
    previewObjectUrl,
  };
}
