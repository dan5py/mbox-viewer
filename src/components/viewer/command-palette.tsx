"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  FilterX,
  Home,
  Keyboard,
  MessageSquare,
  Paperclip,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { type GroupingMode } from "~/hooks/use-viewer-searchparams";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/components/ui/command";

export interface CommandPaletteProps {
  hasFiles: boolean;
  hasActiveFilters: boolean;
  hasSearchQuery: boolean;
  groupingMode: GroupingMode;
  totalPages: number;
  currentPage: number;
  onClearSearch: () => void;
  onResetFilters: () => void;
  onSetGroupingMode: (mode: GroupingMode) => void;
  onSetCurrentPage: (page: number) => void;
  onOpenShortcutsDialog: () => void;
  onOpenAttachmentsCenter: () => void;
  onFocusSearch: () => void;
}

export default function CommandPalette({
  hasFiles,
  hasActiveFilters,
  hasSearchQuery,
  groupingMode,
  totalPages,
  currentPage,
  onClearSearch,
  onResetFilters,
  onSetGroupingMode,
  onSetCurrentPage,
  onOpenShortcutsDialog,
  onOpenAttachmentsCenter,
  onFocusSearch,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Viewer");
  const router = useRouter();

  // Cmd/Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runCommand = useCallback((fn: () => void) => {
    setOpen(false);
    // Delay to let the dialog close before executing
    requestAnimationFrame(fn);
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("commandPalette.title")}
      description={t("commandPalette.description")}
    >
      <CommandInput placeholder={t("commandPalette.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("commandPalette.noResults")}</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading={t("commandPalette.groups.navigation")}>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/settings"))}
          >
            <Settings className="size-4" />
            <span>{t("commandPalette.commands.openSettings")}</span>
          </CommandItem>
          {hasFiles && totalPages > 1 && (
            <>
              <CommandItem
                disabled={currentPage >= totalPages}
                onSelect={() =>
                  runCommand(() =>
                    onSetCurrentPage(Math.min(totalPages, currentPage + 1))
                  )
                }
              >
                <ArrowDown className="size-4" />
                <span>{t("commandPalette.commands.nextPage")}</span>
              </CommandItem>
              <CommandItem
                disabled={currentPage <= 1}
                onSelect={() =>
                  runCommand(() =>
                    onSetCurrentPage(Math.max(1, currentPage - 1))
                  )
                }
              >
                <ArrowUp className="size-4" />
                <span>{t("commandPalette.commands.prevPage")}</span>
              </CommandItem>
            </>
          )}
        </CommandGroup>

        {hasFiles && (
          <>
            <CommandSeparator />

            {/* Search & Filters */}
            <CommandGroup heading={t("commandPalette.groups.searchFilters")}>
              <CommandItem onSelect={() => runCommand(onFocusSearch)}>
                <Search className="size-4" />
                <span>{t("commandPalette.commands.focusSearch")}</span>
                <CommandShortcut>/</CommandShortcut>
              </CommandItem>
              {hasSearchQuery && (
                <CommandItem onSelect={() => runCommand(onClearSearch)}>
                  <X className="size-4" />
                  <span>{t("commandPalette.commands.clearSearch")}</span>
                </CommandItem>
              )}
              {hasActiveFilters && (
                <CommandItem onSelect={() => runCommand(onResetFilters)}>
                  <FilterX className="size-4" />
                  <span>{t("commandPalette.commands.resetFilters")}</span>
                  <CommandShortcut>Shift+Esc</CommandShortcut>
                </CommandItem>
              )}
              <CommandItem
                onSelect={() =>
                  runCommand(() =>
                    onSetGroupingMode(
                      groupingMode === "thread" ? "flat" : "thread"
                    )
                  )
                }
              >
                <MessageSquare className="size-4" />
                <span>
                  {groupingMode === "thread"
                    ? t("commandPalette.commands.disableThreads")
                    : t("commandPalette.commands.enableThreads")}
                </span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            {/* Tools */}
            <CommandGroup heading={t("commandPalette.groups.tools")}>
              <CommandItem onSelect={() => runCommand(onOpenAttachmentsCenter)}>
                <Paperclip className="size-4" />
                <span>{t("commandPalette.commands.attachmentsCenter")}</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(onOpenShortcutsDialog)}>
                <Keyboard className="size-4" />
                <span>{t("commandPalette.commands.showShortcuts")}</span>
                <CommandShortcut>?</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
