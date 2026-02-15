"use client";

import { useTranslations } from "next-intl";
import { Check, Pencil, Trash } from "lucide-react";

import { MailFile } from "~/types/files";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { FileUploadInput } from "~/components/files-uploader/input";

export interface MobileFilesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: MailFile[];
  selectedFileId: string | null;
  editingFileId: string | null;
  editingFileName: string;
  setEditingFileName: (name: string) => void;
  onSelectFile: (fileId: string) => void;
  onStartRename: (fileId: string, currentName: string) => void;
  onCancelRename: () => void;
  onCommitRename: () => void;
  onRequestDelete: (fileId: string) => void;
}

export default function MobileFilesSheet({
  open,
  onOpenChange,
  files,
  selectedFileId,
  editingFileId,
  editingFileName,
  setEditingFileName,
  onSelectFile,
  onStartRename,
  onCancelRename,
  onCommitRename,
  onRequestDelete,
}: MobileFilesSheetProps) {
  const t = useTranslations("Viewer");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="h-[100dvh] w-[88vw] max-w-sm p-0 md:hidden"
      >
        <SheetHeader className="border-b border-border/60">
          <SheetTitle>{t("files.title")}</SheetTitle>
        </SheetHeader>
        <div className="flex h-full flex-col overflow-y-auto p-4 pt-2">
          <div className="pb-4">
            <FileUploadInput
              onUploadCompleteAction={() => onOpenChange(false)}
            />
          </div>
          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={`mobile-${file.id}`}
                  className={cn(
                    "rounded-md border p-2",
                    selectedFileId === file.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50"
                  )}
                >
                  {editingFileId === file.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editingFileName}
                        onChange={(e) => setEditingFileName(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => {
                          const nextTarget =
                            e.relatedTarget as HTMLElement | null;
                          if (nextTarget?.dataset.renameAction) {
                            return;
                          }
                          onCommitRename();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            onCommitRename();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            onCancelRename();
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
                          onClick={onCommitRename}
                        >
                          <Check className="mr-1 size-3" />
                          {t("rename.save")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          data-rename-action="cancel"
                          onClick={onCancelRename}
                        >
                          {t("rename.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectFile(file.id)}
                        className="w-full text-left"
                      >
                        <p
                          className="truncate text-sm font-medium"
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("messages", { count: file.messageCount ?? 0 })}
                        </p>
                      </button>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() =>
                            onStartRename(file.id, file.name)
                          }
                          aria-label={t("rename.ariaLabel")}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onRequestDelete(file.id)}
                          aria-label={t("delete.ariaLabel")}
                        >
                          <Trash className="size-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("noFiles.description")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
