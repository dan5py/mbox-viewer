"use client";

import { lazy, Suspense } from "react";
import { Mail, ScanText } from "lucide-react";

import { useViewer } from "~/hooks/use-viewer";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { FileUploadInput } from "~/components/files-uploader/input";
import { Navbar } from "~/components/navbar";
import { FilesSidebar } from "~/components/viewer/files-sidebar";
import { MessageList } from "~/components/viewer/message-list";
import { MessagePreview } from "~/components/viewer/message-preview";
import { MobileNav } from "~/components/viewer/mobile-nav";

const ExportDialog = lazy(() => import("~/components/viewer/export-dialog"));
const ShortcutsDialog = lazy(
  () => import("~/components/viewer/shortcuts-dialog")
);
const DeleteDialog = lazy(() => import("~/components/viewer/delete-dialog"));
const FullscreenDialog = lazy(
  () => import("~/components/viewer/fullscreen-dialog")
);
const AttachmentPreviewDialog = lazy(
  () => import("~/components/viewer/attachment-preview-dialog")
);
const MobileFilesSheet = lazy(
  () => import("~/components/viewer/mobile-files-sheet")
);

export default function ViewerPage() {
  const {
    // Core
    t,
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

    // Filtering & pagination
    filteredMessageIndices,
    visibleMessageIndices,
    totalMessages,
    totalPages,
    integerFormatter,

    // Computed labels
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
  } = useViewer();

  // Empty state - no files loaded
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
    <div ref={viewerPageRootRef} className="flex h-dvh flex-col">
      <Navbar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Files Sidebar */}
        <FilesSidebar
          files={files}
          selectedFileId={selectedFileId}
          editingFileId={editingFileId}
          editingFileName={editingFileName}
          setEditingFileName={setEditingFileName}
          onSelectFile={handleSelectFile}
          onStartRename={handleStartRenameFile}
          onCancelRename={handleCancelRenameFile}
          onCommitRename={handleCommitRenameFile}
          onRequestDelete={setFileToDelete}
        />

        {/* Messages List */}
        <MessageList
          mobileActivePane={mobileActivePane}
          searchQuery={searchQuery}
          hasSearchQuery={hasSearchQuery}
          isSearching={isSearching}
          searchProgress={searchProgress}
          searchFailed={searchFailed}
          onSearchInputChange={handleSearchInputChange}
          onClearSearch={handleClearSearch}
          totalMessages={totalMessages}
          isActionsMenuOpen={isActionsMenuOpen}
          setIsActionsMenuOpen={setIsActionsMenuOpen}
          selectedCount={selectedCount}
          actionsTriggerLabel={actionsTriggerLabel}
          selectedCountBadgeLabel={selectedCountBadgeLabel}
          onDropdownMenuBoundaryKeyDown={handleDropdownMenuBoundaryKeyDown}
          allVisibleSelected={allVisibleSelected}
          allFilteredSelected={allFilteredSelected}
          togglePageSelectionLabel={togglePageSelectionLabel}
          toggleFilteredSelectionLabel={toggleFilteredSelectionLabel}
          visibleCountLabel={visibleCountLabel}
          filteredCountLabel={filteredCountLabel}
          onToggleCurrentPageSelectionFromMenu={
            handleToggleCurrentPageSelectionFromMenu
          }
          onToggleFilteredSelectionFromMenu={
            handleToggleFilteredSelectionFromMenu
          }
          onClearSelectionFromMenu={handleClearSelectionFromMenu}
          onResetFiltersFromMenu={handleResetFiltersFromMenu}
          onOpenExportDialog={handleOpenExportDialog}
          onOpenShortcutsDialog={handleOpenShortcutsDialog}
          hasActiveFilters={hasActiveFilters}
          toggleFilteredSelectionAriaKeyShortcuts={
            toggleFilteredSelectionAriaKeyShortcuts
          }
          toggleFilteredSelectionShortcutLabel={
            toggleFilteredSelectionShortcutLabel
          }
          clearSelectionAriaKeyShortcuts={clearSelectionAriaKeyShortcuts}
          clearSelectionShortcutLabel={clearSelectionShortcutLabel}
          resetFiltersAriaKeyShortcuts={resetFiltersAriaKeyShortcuts}
          resetFiltersShortcutLabel={resetFiltersShortcutLabel}
          openShortcutsAriaKeyShortcuts={openShortcutsAriaKeyShortcuts}
          openShortcutsShortcutLabel={openShortcutsShortcutLabel}
          shouldShowLabelFiltersRow={shouldShowLabelFiltersRow}
          labelFiltersGroupRef={labelFiltersGroupRef}
          labelFiltersGroupLabel={labelFiltersGroupLabel}
          onLabelFiltersGroupKeyDown={handleLabelFiltersGroupKeyDown}
          selectedLabel={selectedLabel}
          onSelectLabelFilter={handleSelectLabelFilter}
          getLabelFilterChipClassName={getLabelFilterChipClassName}
          allEmailsFilterAriaLabel={allEmailsFilterAriaLabel}
          allEmailsFilterTitle={allEmailsFilterTitle}
          allEmailsLabel={allEmailsLabel}
          allEmailsFilterCount={allEmailsFilterCount}
          renderLabelChipContent={renderLabelChipContent}
          inlineLabelFilters={inlineLabelFilters}
          labelDisplayCounts={labelDisplayCounts}
          getLabelMessageCount={getLabelMessageCount}
          getLabelFilterButtonLabel={getLabelFilterButtonLabel}
          overflowLabelFilters={overflowLabelFilters}
          isLabelOverflowMenuOpen={isLabelOverflowMenuOpen}
          setIsLabelOverflowMenuOpen={setIsLabelOverflowMenuOpen}
          labelOverflowMenuContentId={labelOverflowMenuContentId}
          moreLabelsTriggerAriaLabel={moreLabelsTriggerAriaLabel}
          moreLabelsTriggerText={moreLabelsTriggerText}
          moreLabelsMenuAriaLabel={moreLabelsMenuAriaLabel}
          onSelectOverflowLabelFilter={handleSelectOverflowLabelFilter}
          onSelectOverflowAllEmails={handleSelectOverflowAllEmails}
          shouldShowHeaderStatusRow={shouldShowHeaderStatusRow}
          integerFormatter={integerFormatter}
          messageSummaryLabel={messageSummaryLabel}
          visibleMessageIndices={visibleMessageIndices}
          selectedMessageIndex={selectedMessageIndex}
          selectedMessageIndices={selectedMessageIndices}
          messageRefs={messageRefs}
          currentFile={currentFile}
          onSelectMessage={handleSelectMessage}
          onToggleMessageSelection={handleToggleMessageSelection}
          totalPages={totalPages}
          currentPage={currentPage}
          onSetCurrentPage={setCurrentPage}
        />

        {/* Message Preview */}
        <MessagePreview
          mobileActivePane={mobileActivePane}
          selectedMessageData={selectedMessageData}
          selectedMessageIndex={selectedMessageIndex}
          loadingMessage={loadingMessage}
          effectiveTab={effectiveTab}
          hasBody={hasBody}
          hasAttachments={hasAttachments}
          tab={tab}
          setTab={setTab}
          bodyTab={bodyTab}
          setBodyTab={setBodyTab}
          headerExpanded={headerExpanded}
          setHeaderExpanded={setHeaderExpanded}
          expandedRecipients={expandedRecipients}
          onToggleRecipientExpanded={handleToggleRecipientExpanded}
          onOpenFullscreen={() => setIsFullscreenOpen(true)}
          onPreviewAttachment={setPreviewedAttachment}
        />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        mobileActivePane={mobileActivePane}
        isMobileFilesSheetOpen={isMobileFilesSheetOpen}
        onOpenFilesSheet={() => setIsMobileFilesSheetOpen(true)}
        onSetActivePane={setMobileActivePane}
      />

      {/* Dialogs and sheets */}
      {isMobileFilesSheetOpen && (
        <Suspense fallback={null}>
          <MobileFilesSheet
            open={isMobileFilesSheetOpen}
            onOpenChange={setIsMobileFilesSheetOpen}
            files={files}
            selectedFileId={selectedFileId}
            editingFileId={editingFileId}
            editingFileName={editingFileName}
            setEditingFileName={setEditingFileName}
            onSelectFile={handleSelectFile}
            onStartRename={handleStartRenameFile}
            onCancelRename={handleCancelRenameFile}
            onCommitRename={handleCommitRenameFile}
            onRequestDelete={setFileToDelete}
          />
        </Suspense>
      )}

      {isExportDialogOpen && (
        <Suspense fallback={null}>
          <ExportDialog
            open={isExportDialogOpen}
            onOpenChange={setIsExportDialogOpen}
            selectedCount={selectedCount}
            exportFormat={exportFormat}
            setExportFormat={setExportFormat}
            includeAttachmentsInExport={includeAttachmentsInExport}
            setIncludeAttachmentsInExport={setIncludeAttachmentsInExport}
            isExporting={isExporting}
            exportProgress={exportProgress}
            onExport={handleExportSelectedMessages}
            onCancelExport={handleCancelExport}
          />
        </Suspense>
      )}

      {isShortcutsDialogOpen && (
        <Suspense fallback={null}>
          <ShortcutsDialog
            open={isShortcutsDialogOpen}
            onOpenChange={setIsShortcutsDialogOpen}
            shortcutModifierLabel={shortcutModifierLabel}
            clearPreviewShortcutLabel={clearPreviewShortcutLabel}
          />
        </Suspense>
      )}

      {fileToDelete !== null && (
        <Suspense fallback={null}>
          <DeleteDialog
            open={fileToDelete !== null}
            onClose={() => setFileToDelete(null)}
            fileName={files.find((f) => f.id === fileToDelete)?.name}
            onConfirm={() => {
              if (fileToDelete) {
                handleDeleteFile(fileToDelete);
                setFileToDelete(null);
              }
            }}
          />
        </Suspense>
      )}

      {isFullscreenOpen && (
        <Suspense fallback={null}>
          <FullscreenDialog
            open={isFullscreenOpen}
            onOpenChange={setIsFullscreenOpen}
            messageData={selectedMessageData}
            bodyTab={bodyTab}
            setBodyTab={setBodyTab}
          />
        </Suspense>
      )}

      {!!previewedAttachment && (
        <Suspense fallback={null}>
          <AttachmentPreviewDialog
            attachment={previewedAttachment}
            previewObjectUrl={previewObjectUrl}
            onClose={() => setPreviewedAttachment(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
