"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface RecipientListProps {
  addresses: Array<{ name: string; email: string }>;
  maxVisible?: number;
  type: "to" | "cc";
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export function RecipientList({
  addresses,
  maxVisible = 2,
  type,
  isExpanded,
  onToggleExpanded,
}: RecipientListProps) {
  const t = useTranslations("Viewer");
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
        <div key={`${type}-${idx}`} className="flex items-center gap-2 min-w-0">
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
          onClick={onToggleExpanded}
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
}
