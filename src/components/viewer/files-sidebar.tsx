"use client";

import { Check, FileText, Pencil, Trash } from "lucide-react";
import { useTranslations } from "next-intl";

import { MailFile } from "~/types/files";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { FileUploadInput } from "~/components/files-uploader/input";

export interface FilesSidebarProps {
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

export function FilesSidebar({
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
}: FilesSidebarProps) {
  const t = useTranslations("Viewer");

  return (
    <div className="hidden md:block w-72 border-r border-border bg-muted/20 p-4 overflow-y-auto">
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
                      onSelectFile(file.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      editingFileId !== file.id &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      onSelectFile(file.id);
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
                                onCommitRename();
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
                                onCancelRename();
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
                        onStartRename(file.id, file.name);
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
                        onRequestDelete(file.id);
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
  );
}
