"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { it } from "date-fns/locale/it";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Calendar,
  Mail,
  MoreHorizontal,
  Search,
  User,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MailFile } from "~/types/files";
import { formatSize, getAvatarColor, getInitials } from "~/lib/email-utils";
import { cn } from "~/lib/utils";
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

export interface MessageListProps {
  // Pane visibility
  mobileActivePane: "messages" | "preview";

  // Search
  searchQuery: string;
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
}

export function MessageList({
  mobileActivePane,
  searchQuery,
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
}: MessageListProps) {
  const t = useTranslations("Viewer");
  const locale = useLocale();
  const dateLocale = locale === "it" ? it : enUS;

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
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t("search.placeholder")}
              value={searchQuery}
              onChange={(e) => onSearchInputChange(e.target.value)}
              className="text-sm pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={onClearSearch}
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

        {shouldShowHeaderStatusRow && (
          <div className="flex items-center min-w-0">
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
      <div
        className="flex-1 overflow-y-auto p-2 space-y-1.5"
        role="region"
        aria-label={t("preview.messageListRegion")}
        aria-keyshortcuts="ArrowUp ArrowDown"
      >
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
            const isSelected = selectedMessageIndex === index;
            const isMessageChecked = selectedMessageIndices.has(index);
            const messageSubjectLabel =
              preview?.subject || t("preview.noSubject");
            const messageSubjectForAria =
              preview?.subject || t("preview.noSubject");
            const from = preview?.from || t("preview.unknown");
            const date = preview?.date ? new Date(preview.date) : new Date();
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
