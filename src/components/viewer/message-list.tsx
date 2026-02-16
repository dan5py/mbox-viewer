"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useRef,
  useState,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { it } from "date-fns/locale/it";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Calendar,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Search,
  User,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MailFile } from "~/types/files";
import { formatSize, getAvatarColor, getInitials } from "~/lib/email-utils";
import { type ThreadGroup } from "~/lib/thread-grouping";
import { cn } from "~/lib/utils";
import { type GroupingMode } from "~/hooks/use-viewer-searchparams";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import {
  FilterChipsBar,
  SearchSuggestions,
  SuggestionsPanel,
} from "~/components/viewer/search-suggestions";

export interface MessageListProps {
  // Pane visibility
  mobileActivePane: "messages" | "preview";

  // Search
  searchInputRef?: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  allLabels: string[];
  hasSearchQuery: boolean;
  isSearching: boolean;
  searchProgress: number;
  searchFailed: boolean;
  onSearchInputChange: (value: string) => void;
  onClearSearch: () => void;

  // Actions menu
  totalMessages: number;
  isActionsMenuOpen: boolean;
  setIsActionsMenuOpen: (open: boolean) => void;
  selectedCount: number;
  actionsTriggerLabel: string;
  selectedCountBadgeLabel: string;
  onDropdownMenuBoundaryKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>
  ) => void;

  // Selection actions
  allVisibleSelected: boolean;
  allFilteredSelected: boolean;
  togglePageSelectionLabel: string;
  toggleFilteredSelectionLabel: string;
  visibleCountLabel: string;
  filteredCountLabel: string;
  onToggleCurrentPageSelectionFromMenu: () => void;
  onToggleFilteredSelectionFromMenu: () => void;
  onClearSelectionFromMenu: () => void;
  onResetFiltersFromMenu: () => void;
  onOpenExportDialog: () => void;
  onOpenShortcutsDialog: () => void;
  hasActiveFilters: boolean;
  toggleFilteredSelectionAriaKeyShortcuts: string;
  toggleFilteredSelectionShortcutLabel: string;
  clearSelectionAriaKeyShortcuts: string;
  clearSelectionShortcutLabel: string;
  resetFiltersAriaKeyShortcuts: string;
  resetFiltersShortcutLabel: string;
  openShortcutsAriaKeyShortcuts: string;
  openShortcutsShortcutLabel: string;

  // Labels
  shouldShowLabelFiltersRow: boolean;
  labelFiltersGroupRef: RefObject<HTMLDivElement | null>;
  labelFiltersGroupLabel: string;
  onLabelFiltersGroupKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>
  ) => void;
  selectedLabel: string | null;
  onSelectLabelFilter: (label: string | null) => void;
  getLabelFilterChipClassName: (isActive: boolean) => string;
  allEmailsFilterAriaLabel: string;
  allEmailsFilterTitle: string;
  allEmailsLabel: string;
  allEmailsFilterCount: string;
  renderLabelChipContent: (
    label: string,
    count: string,
    isActive: boolean
  ) => React.ReactNode;
  inlineLabelFilters: string[];
  labelDisplayCounts: Map<string, number>;
  getLabelMessageCount: (label: string) => string;
  getLabelFilterButtonLabel: (label: string, count: number) => string;
  overflowLabelFilters: string[];
  isLabelOverflowMenuOpen: boolean;
  setIsLabelOverflowMenuOpen: (open: boolean) => void;
  labelOverflowMenuContentId: string;
  moreLabelsTriggerAriaLabel: string;
  moreLabelsTriggerText: string;
  moreLabelsMenuAriaLabel: string;
  onSelectOverflowLabelFilter: (
    label: string,
    checked: boolean | "indeterminate"
  ) => void;
  onSelectOverflowAllEmails: () => void;

  // Status row
  shouldShowHeaderStatusRow: boolean;
  integerFormatter: Intl.NumberFormat;
  messageSummaryLabel: string;

  // Message list
  visibleMessageIndices: number[];
  selectedMessageIndex: number | null;
  selectedMessageIndices: Set<number>;
  messageRefs: RefObject<Map<number, HTMLButtonElement>>;
  currentFile: MailFile | undefined;
  onSelectMessage: (index: number) => void;
  onToggleMessageSelection: (index: number, extendRange?: boolean) => void;

  // Pagination
  totalPages: number;
  currentPage: number;
  onSetCurrentPage: (page: number) => void;

  // Thread grouping
  groupingMode: GroupingMode;
  onSetGroupingMode: (mode: GroupingMode) => void;
  threadGroups: ThreadGroup[] | null;
}

export function MessageList({
  mobileActivePane,
  searchInputRef,
  searchQuery,
  allLabels,
  hasSearchQuery,
  isSearching,
  searchProgress,
  searchFailed,
  onSearchInputChange,
  onClearSearch,
  totalMessages,
  isActionsMenuOpen,
  setIsActionsMenuOpen,
  selectedCount,
  actionsTriggerLabel,
  selectedCountBadgeLabel,
  onDropdownMenuBoundaryKeyDown,
  allVisibleSelected,
  allFilteredSelected,
  togglePageSelectionLabel,
  toggleFilteredSelectionLabel,
  visibleCountLabel,
  filteredCountLabel,
  onToggleCurrentPageSelectionFromMenu,
  onToggleFilteredSelectionFromMenu,
  onClearSelectionFromMenu,
  onResetFiltersFromMenu,
  onOpenExportDialog,
  onOpenShortcutsDialog,
  hasActiveFilters,
  toggleFilteredSelectionAriaKeyShortcuts,
  toggleFilteredSelectionShortcutLabel,
  clearSelectionAriaKeyShortcuts,
  clearSelectionShortcutLabel,
  resetFiltersAriaKeyShortcuts,
  resetFiltersShortcutLabel,
  openShortcutsAriaKeyShortcuts,
  openShortcutsShortcutLabel,
  shouldShowLabelFiltersRow,
  labelFiltersGroupRef,
  labelFiltersGroupLabel,
  onLabelFiltersGroupKeyDown,
  selectedLabel,
  onSelectLabelFilter,
  getLabelFilterChipClassName,
  allEmailsFilterAriaLabel,
  allEmailsFilterTitle,
  allEmailsLabel,
  allEmailsFilterCount,
  renderLabelChipContent,
  inlineLabelFilters,
  labelDisplayCounts,
  getLabelMessageCount,
  getLabelFilterButtonLabel,
  overflowLabelFilters,
  isLabelOverflowMenuOpen,
  setIsLabelOverflowMenuOpen,
  labelOverflowMenuContentId,
  moreLabelsTriggerAriaLabel,
  moreLabelsTriggerText,
  moreLabelsMenuAriaLabel,
  onSelectOverflowLabelFilter,
  onSelectOverflowAllEmails,
  shouldShowHeaderStatusRow,
  integerFormatter,
  messageSummaryLabel,
  visibleMessageIndices,
  selectedMessageIndex,
  selectedMessageIndices,
  messageRefs,
  currentFile,
  onSelectMessage,
  onToggleMessageSelection,
  totalPages,
  currentPage,
  onSetCurrentPage,
  groupingMode,
  onSetGroupingMode,
  threadGroups,
}: MessageListProps) {
  const t = useTranslations("Viewer");
  const locale = useLocale();
  const dateLocale = locale === "it" ? it : enUS;
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(
    new Set()
  );
  const localSearchInputRef = useRef<HTMLInputElement | null>(null);
  const effectiveSearchInputRef = searchInputRef ?? localSearchInputRef;

  const searchSuggestions = SearchSuggestions({
    searchQuery,
    onSearchInputChange: onSearchInputChange,
    searchInputRef: effectiveSearchInputRef,
    allLabels,
  });

  const toggleThread = (threadIndex: number) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadIndex)) {
        next.delete(threadIndex);
      } else {
        next.add(threadIndex);
      }
      return next;
    });
  };

  const getMessagePreview = (index: number) => {
    if (!currentFile?.messageBoundaries) return null;
    const boundary = currentFile.messageBoundaries[index];
    return boundary?.preview;
  };

  return (
    <div
      className={cn(
        "w-full min-w-0 bg-background flex flex-col md:w-96 md:border-r md:border-border/60",
        mobileActivePane !== "messages" && "hidden md:flex"
      )}
    >
      {/* Search */}
      <div className="border-b border-border/60 p-2.5 space-y-2 bg-muted/20">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
            <Input
              ref={effectiveSearchInputRef}
              placeholder={t("search.placeholder")}
              value={searchQuery}
              onChange={(e) => searchSuggestions.handleInputChange(e.target.value)}
              onKeyDown={searchSuggestions.handleInputKeyDown}
              onFocus={searchSuggestions.handleInputFocus}
              className="text-sm pl-9 pr-9"
              role="combobox"
              aria-expanded={searchSuggestions.isOpen}
              aria-autocomplete="list"
              aria-controls="search-suggestions-listbox"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={onClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors z-10"
                aria-label={t("search.clear")}
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
            <SuggestionsPanel
              isOpen={searchSuggestions.isOpen}
              suggestions={searchSuggestions.suggestions}
              selectedIndex={searchSuggestions.selectedIndex}
              suggestionsRef={searchSuggestions.suggestionsRef}
              itemRefs={searchSuggestions.itemRefs}
              applySuggestion={searchSuggestions.applySuggestion}
              setIsOpen={searchSuggestions.setIsOpen}
              t={searchSuggestions.t}
            />
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
              <DropdownMenuContent
                align="end"
                loop
                aria-label={actionsTriggerLabel}
                aria-keyshortcuts="Home End"
                onKeyDown={onDropdownMenuBoundaryKeyDown}
                className="w-56"
              >
                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                  {t("selection.sections.selection")}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    onToggleCurrentPageSelectionFromMenu();
                  }}
                  disabled={visibleMessageIndices.length === 0}
                >
                  {togglePageSelectionLabel}{" "}
                  <span className="text-muted-foreground/80">
                    ({visibleCountLabel})
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onToggleFilteredSelectionFromMenu();
                  }}
                  disabled={visibleMessageIndices.length === 0}
                  aria-keyshortcuts={toggleFilteredSelectionAriaKeyShortcuts}
                >
                  {toggleFilteredSelectionLabel}{" "}
                  <span className="text-muted-foreground/80">
                    ({filteredCountLabel})
                  </span>
                  <DropdownMenuShortcut>
                    {toggleFilteredSelectionShortcutLabel}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                {/* <DropdownMenuSeparator /> */}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={onClearSelectionFromMenu}
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
                  onClick={onResetFiltersFromMenu}
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
                  onClick={onOpenExportDialog}
                  disabled={selectedCount === 0}
                >
                  {t("export.action")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onOpenShortcutsDialog}
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

        {/* Active filter chips */}
        <FilterChipsBar
          searchQuery={searchQuery}
          onSearchInputChange={onSearchInputChange}
        />

        {/* Label Filter Pills */}
        {shouldShowLabelFiltersRow && (
          <ScrollArea className="w-full">
            <div
              ref={labelFiltersGroupRef}
              className="flex gap-1.5 pb-1"
              role="group"
              aria-label={labelFiltersGroupLabel}
              aria-keyshortcuts="ArrowLeft ArrowRight Home End"
              onKeyDown={onLabelFiltersGroupKeyDown}
            >
              <button
                data-label-filter-chip="true"
                type="button"
                onClick={() => onSelectLabelFilter(null)}
                className={getLabelFilterChipClassName(selectedLabel === null)}
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
                const labelCountValue = labelDisplayCounts.get(label) ?? 0;
                const labelCount = getLabelMessageCount(label);
                const isLabelActive = selectedLabel === label;

                return (
                  <button
                    key={label}
                    data-label-filter-chip="true"
                    type="button"
                    onClick={() => onSelectLabelFilter(label)}
                    className={getLabelFilterChipClassName(isLabelActive)}
                    aria-pressed={isLabelActive}
                    aria-label={getLabelFilterButtonLabel(
                      label,
                      labelCountValue
                    )}
                    title={`${label} (${labelCount})`}
                  >
                    {renderLabelChipContent(label, labelCount, isLabelActive)}
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
                      data-label-filter-chip="true"
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
                      <span className="truncate">{moreLabelsTriggerText}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    id={labelOverflowMenuContentId}
                    align="start"
                    loop
                    aria-label={moreLabelsMenuAriaLabel}
                    aria-keyshortcuts="Home End"
                    onKeyDown={onDropdownMenuBoundaryKeyDown}
                    className="max-h-72 w-56 overflow-y-auto"
                  >
                    {selectedLabel !== null && (
                      <>
                        <DropdownMenuItem
                          onClick={onSelectOverflowAllEmails}
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
                    {overflowLabelFilters.map((label) => {
                      const labelCountValue =
                        labelDisplayCounts.get(label) ?? 0;
                      const labelCount = getLabelMessageCount(label);

                      return (
                        <DropdownMenuCheckboxItem
                          key={label}
                          checked={selectedLabel === label}
                          onCheckedChange={(checked) =>
                            onSelectOverflowLabelFilter(label, checked)
                          }
                          aria-label={getLabelFilterButtonLabel(
                            label,
                            labelCountValue
                          )}
                          title={`${label} (${labelCount})`}
                        >
                          <span className="truncate">{label}</span>
                          <DropdownMenuShortcut>
                            {labelCount}
                          </DropdownMenuShortcut>
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <ScrollBar orientation="horizontal" hidden />
          </ScrollArea>
        )}

        {(shouldShowHeaderStatusRow || totalMessages > 0) && (
          <div className="flex items-center min-w-0 gap-1">
            <div
              className="min-w-0 flex-1"
              aria-live={isSearching ? "off" : "polite"}
              aria-atomic="true"
            >
              {isSearching ? (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground min-w-0">
                  <Spinner className="size-3" label={t("search.searching")} />
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
              ) : shouldShowHeaderStatusRow ? (
                totalMessages > 0 && (
                  <p
                    className="text-[11px] text-muted-foreground font-medium truncate"
                    title={messageSummaryLabel}
                  >
                    {messageSummaryLabel}
                  </p>
                )
              ) : null}
            </div>
            {totalMessages > 0 && (
              <Button
                variant={groupingMode === "thread" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[11px] shrink-0"
                onClick={() =>
                  onSetGroupingMode(
                    groupingMode === "thread" ? "flat" : "thread"
                  )
                }
                aria-label={t("threads.toggle")}
                title={t("threads.toggle")}
              >
                <MessageSquare className="size-3 mr-1" />
                {t("threads.label")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Message List */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-1.5"
        role="region"
        aria-label={t("preview.messageListRegion")}
        aria-keyshortcuts="ArrowUp ArrowDown"
      >
        {visibleMessageIndices.length === 0 && !threadGroups ? (
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
        ) : groupingMode === "thread" && threadGroups ? (
          /* Thread mode */
          threadGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Mail className="size-10 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                {t("search.noMessages")}
              </p>
            </div>
          ) : (
            threadGroups.map((thread, threadIdx) => {
              const isExpanded = expandedThreads.has(threadIdx);
              const rootIndex = thread.messageIndices[0];
              const rootPreview = getMessagePreview(rootIndex);
              const threadDate = rootPreview?.date
                ? new Date(rootPreview.date)
                : new Date();

              if (thread.count === 1) {
                return (
                  <MessageCard
                    key={`thread-${threadIdx}`}
                    index={rootIndex}
                    preview={rootPreview}
                    isSelected={selectedMessageIndex === rootIndex}
                    isMessageChecked={selectedMessageIndices.has(rootIndex)}
                    locale={locale}
                    dateLocale={dateLocale}
                    t={t}
                    messageRefs={messageRefs}
                    onSelectMessage={onSelectMessage}
                    onToggleMessageSelection={onToggleMessageSelection}
                  />
                );
              }

              return (
                <div key={`thread-${threadIdx}`} className="space-y-0.5">
                  <button
                    onClick={() => toggleThread(threadIdx)}
                    className={cn(
                      "w-full p-2 rounded-lg border transition-all text-left",
                      "hover:border-border hover:shadow-sm",
                      "border-border/40 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {thread.subject}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {t("threads.count", { count: thread.count })}
                          </Badge>
                          <span>
                            {formatDistanceToNow(threadDate, {
                              addSuffix: true,
                              locale: dateLocale,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                  {isExpanded &&
                    thread.messageIndices.map((msgIndex) => {
                      const preview = getMessagePreview(msgIndex);
                      return (
                        <div key={msgIndex} className="ml-6">
                          <MessageCard
                            index={msgIndex}
                            preview={preview}
                            isSelected={selectedMessageIndex === msgIndex}
                            isMessageChecked={selectedMessageIndices.has(
                              msgIndex
                            )}
                            locale={locale}
                            dateLocale={dateLocale}
                            t={t}
                            messageRefs={messageRefs}
                            onSelectMessage={onSelectMessage}
                            onToggleMessageSelection={
                              onToggleMessageSelection
                            }
                          />
                        </div>
                      );
                    })}
                </div>
              );
            })
          )
        ) : (
          /* Flat mode */
          visibleMessageIndices.map((index) => {
            const preview = getMessagePreview(index);
            return (
              <MessageCard
                key={index}
                index={index}
                preview={preview}
                isSelected={selectedMessageIndex === index}
                isMessageChecked={selectedMessageIndices.has(index)}
                locale={locale}
                dateLocale={dateLocale}
                t={t}
                messageRefs={messageRefs}
                onSelectMessage={onSelectMessage}
                onToggleMessageSelection={onToggleMessageSelection}
              />
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="border-t border-border/60 p-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => onSetCurrentPage(Math.max(1, currentPage - 1))}
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
                onSetCurrentPage(Math.min(totalPages, currentPage + 1))
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
  );
}

// ── MessageCard ─────────────────────────────────────────────────────

interface MessageCardProps {
  index: number;
  preview:
    | {
        from: string;
        to: string;
        subject: string;
        date: string;
        size: number;
        labels?: string[];
        messageId?: string;
        inReplyTo?: string;
        references?: string[];
      }
    | null
    | undefined;
  isSelected: boolean;
  isMessageChecked: boolean;
  locale: string;
  dateLocale: typeof enUS;
  t: ReturnType<typeof useTranslations<"Viewer">>;
  messageRefs: RefObject<Map<number, HTMLButtonElement>>;
  onSelectMessage: (index: number) => void;
  onToggleMessageSelection: (index: number, extendRange?: boolean) => void;
}

function MessageCard({
  index,
  preview,
  isSelected,
  isMessageChecked,
  locale,
  dateLocale,
  t,
  messageRefs,
  onSelectMessage,
  onToggleMessageSelection,
}: MessageCardProps) {
  const messageSubjectLabel = preview?.subject || t("preview.noSubject");
  const messageSubjectForAria = preview?.subject || t("preview.noSubject");
  const from = preview?.from || t("preview.unknown");
  const date = preview?.date ? new Date(preview.date) : new Date();
  const relativeDate = formatDistanceToNow(date, {
    addSuffix: true,
    locale: dateLocale,
  });

  return (
    <div
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
          data-allow-global-shortcuts="true"
          checked={isMessageChecked}
          onClick={(event) => {
            event.stopPropagation();
            onToggleMessageSelection(index, event.shiftKey);
          }}
          aria-label={t("selection.toggleMessageWithSubject", {
            subject: messageSubjectForAria,
          })}
          className="mt-2"
        />

        <button
          data-allow-global-shortcuts="true"
          ref={(el) => {
            if (el) {
              messageRefs.current.set(index, el);
            } else {
              messageRefs.current.delete(index);
            }
          }}
          onClick={() => onSelectMessage(index)}
          className="flex-1 min-w-0 text-left p-1 rounded-md cursor-pointer"
        >
          <div className="flex gap-3">
            <div
              className={cn(
                "size-10 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0",
                getAvatarColor(from)
              )}
            >
              {getInitials(from)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p
                  className={cn(
                    "text-sm font-semibold truncate",
                    isSelected ? "text-primary" : "text-foreground"
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
}
