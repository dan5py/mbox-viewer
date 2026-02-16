"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AtSign,
  Calendar,
  FileText,
  Hash,
  Mail,
  Paperclip,
  Search,
  Tag,
  Type,
  User,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "~/lib/utils";

// ── Filter chip tokenizer ───────────────────────────────────────────

export interface FilterChip {
  /** The raw text of this token in the query string */
  raw: string;
  /** Start index in the query string */
  start: number;
  /** End index in the query string (exclusive) */
  end: number;
  /** Parsed field name (e.g. "from", "label", "has") or null for free text */
  field: string | null;
  /** The value part (e.g. the text after "from:") */
  value: string;
  /** Whether this is a structured filter (field:value) vs free text */
  isFilter: boolean;
}

const CHIP_FIELD_PATTERN =
  /^(from|to|subject|body|label|has|before|after):(.+)$/i;

/**
 * Parse a search query string into a list of filter chips.
 * Each whitespace-delimited token that matches `field:value` becomes a chip.
 * Quoted values like `from:"John Doe"` are handled.
 */
export function parseFilterChips(query: string): FilterChip[] {
  const chips: FilterChip[] = [];
  let i = 0;

  while (i < query.length) {
    // Skip leading whitespace
    if (/\s/.test(query[i])) {
      i++;
      continue;
    }

    const tokenStart = i;

    // Read a full token, respecting quotes
    let token = "";
    while (i < query.length && !/\s/.test(query[i])) {
      if (query[i] === '"') {
        // Read until closing quote
        token += query[i];
        i++;
        while (i < query.length && query[i] !== '"') {
          token += query[i];
          i++;
        }
        if (i < query.length) {
          token += query[i]; // closing quote
          i++;
        }
      } else {
        token += query[i];
        i++;
      }
    }

    const tokenEnd = i;

    // Check if it's a field:value filter
    const match = token.match(CHIP_FIELD_PATTERN);
    if (match) {
      const field = match[1].toLowerCase();
      let value = match[2];
      // Strip surrounding quotes from value
      if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
        value = value.slice(1, -1);
      }
      chips.push({
        raw: token,
        start: tokenStart,
        end: tokenEnd,
        field,
        value,
        isFilter: true,
      });
    } else {
      // Check for logic keywords -- don't make them chips
      const upper = token.toUpperCase();
      if (upper === "AND" || upper === "OR" || upper === "NOT") {
        chips.push({
          raw: token,
          start: tokenStart,
          end: tokenEnd,
          field: null,
          value: token,
          isFilter: false,
        });
      } else {
        chips.push({
          raw: token,
          start: tokenStart,
          end: tokenEnd,
          field: null,
          value: token,
          isFilter: false,
        });
      }
    }
  }

  return chips;
}

/**
 * Remove a chip from the query string and return the new query.
 */
export function removeChipFromQuery(
  query: string,
  chip: FilterChip
): string {
  const before = query.slice(0, chip.start);
  const after = query.slice(chip.end);
  // Clean up double spaces
  return (before + after).replace(/\s{2,}/g, " ").trim();
}

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  from: "From",
  to: "To",
  subject: "Subject",
  body: "Body",
  label: "Label",
  has: "Has",
  before: "Before",
  after: "After",
};

const FIELD_COLORS: Record<string, string> = {
  from: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
  to: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25",
  subject:
    "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
  body: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/25",
  label:
    "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25",
  has: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25",
  before: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25",
  after: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/25",
};

// ── FilterChipsBar component ────────────────────────────────────────

export interface FilterChipsBarProps {
  searchQuery: string;
  onSearchInputChange: (value: string) => void;
}

export function FilterChipsBar({
  searchQuery,
  onSearchInputChange,
}: FilterChipsBarProps) {
  const chips = useMemo(() => parseFilterChips(searchQuery), [searchQuery]);
  const filterChips = chips.filter((c) => c.isFilter);

  if (filterChips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-1 pb-1">
      {filterChips.map((chip, idx) => (
        <span
          key={`${chip.start}-${idx}`}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md border text-[11px] font-medium leading-none",
            FIELD_COLORS[chip.field!] ??
              "bg-muted text-muted-foreground border-border"
          )}
        >
          <span className="px-1.5 py-1 text-[10px] opacity-70">
            {FIELD_DISPLAY_NAMES[chip.field!] ?? chip.field}
          </span>
          <span className="opacity-40">=</span>
          <span className="px-1.5 py-1 font-semibold max-w-32 truncate">
            {chip.value}
          </span>
          <button
            type="button"
            className="px-1 py-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-r-md transition-colors"
            onClick={() => {
              onSearchInputChange(removeChipFromQuery(searchQuery, chip));
            }}
            aria-label={`Remove ${FIELD_DISPLAY_NAMES[chip.field!] ?? chip.field}: ${chip.value}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

// ── Suggestion definitions ──────────────────────────────────────────

interface SuggestionItem {
  /** What gets inserted into the search input */
  insert: string;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Category for grouping */
  category: "operator" | "value";
}

const OPERATOR_SUGGESTIONS: SuggestionItem[] = [
  {
    insert: "from:",
    label: "from:",
    description: "searchSuggestions.operators.from",
    icon: User,
    category: "operator",
  },
  {
    insert: "to:",
    label: "to:",
    description: "searchSuggestions.operators.to",
    icon: Mail,
    category: "operator",
  },
  {
    insert: "subject:",
    label: "subject:",
    description: "searchSuggestions.operators.subject",
    icon: Type,
    category: "operator",
  },
  {
    insert: "body:",
    label: "body:",
    description: "searchSuggestions.operators.body",
    icon: FileText,
    category: "operator",
  },
  {
    insert: "label:",
    label: "label:",
    description: "searchSuggestions.operators.label",
    icon: Tag,
    category: "operator",
  },
  {
    insert: "has:attachment",
    label: "has:attachment",
    description: "searchSuggestions.operators.hasAttachment",
    icon: Paperclip,
    category: "operator",
  },
  {
    insert: "before:",
    label: "before:",
    description: "searchSuggestions.operators.before",
    icon: Calendar,
    category: "operator",
  },
  {
    insert: "after:",
    label: "after:",
    description: "searchSuggestions.operators.after",
    icon: Calendar,
    category: "operator",
  },
];

const LOGIC_SUGGESTIONS: SuggestionItem[] = [
  {
    insert: "AND ",
    label: "AND",
    description: "searchSuggestions.logic.and",
    icon: Hash,
    category: "operator",
  },
  {
    insert: "OR ",
    label: "OR",
    description: "searchSuggestions.logic.or",
    icon: Hash,
    category: "operator",
  },
  {
    insert: "NOT ",
    label: "NOT",
    description: "searchSuggestions.logic.not",
    icon: Hash,
    category: "operator",
  },
];

// ── Context analysis ────────────────────────────────────────────────

interface CursorContext {
  /** The portion of the query before the cursor's current token */
  prefix: string;
  /** The token being typed at the cursor position */
  currentToken: string;
  /** Whether we're inside a field operator value (e.g. after "label:") */
  activeOperator: string | null;
}

function analyzeCursorContext(
  query: string,
  cursorPos: number
): CursorContext {
  const textBeforeCursor = query.slice(0, cursorPos);

  // Find the start of the current token (last whitespace boundary)
  let tokenStart = textBeforeCursor.length;
  for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
    if (/\s/.test(textBeforeCursor[i])) {
      tokenStart = i + 1;
      break;
    }
    if (i === 0) {
      tokenStart = 0;
    }
  }

  const currentToken = textBeforeCursor.slice(tokenStart);
  const prefix = textBeforeCursor.slice(0, tokenStart);

  // Check if we're typing a value for a field operator
  const operatorPrefixes = [
    "from:",
    "to:",
    "subject:",
    "body:",
    "label:",
    "before:",
    "after:",
    "has:",
  ];

  let activeOperator: string | null = null;
  const lowerToken = currentToken.toLowerCase();
  for (const op of operatorPrefixes) {
    if (lowerToken.startsWith(op) && lowerToken.length > op.length) {
      activeOperator = op;
      break;
    }
  }

  return { prefix, currentToken, activeOperator };
}

// ── Component ───────────────────────────────────────────────────────

export interface SearchSuggestionsProps {
  searchQuery: string;
  onSearchInputChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  allLabels: string[];
}

export function SearchSuggestions({
  searchQuery,
  onSearchInputChange,
  searchInputRef,
  allLabels,
}: SearchSuggestionsProps) {
  const t = useTranslations("Viewer");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const context = useMemo(() => {
    const cursorPos =
      searchInputRef.current?.selectionStart ?? searchQuery.length;
    return analyzeCursorContext(searchQuery, cursorPos);
  }, [searchQuery, searchInputRef]);

  const suggestions = useMemo((): SuggestionItem[] => {
    const { currentToken, activeOperator } = context;
    const lowerToken = currentToken.toLowerCase();

    // If typing a value for label:, suggest matching labels
    if (activeOperator === "label:") {
      const valueTyped = currentToken.slice("label:".length).toLowerCase();
      return allLabels
        .filter((label) => label.toLowerCase().includes(valueTyped))
        .slice(0, 8)
        .map((label) => ({
          insert: `label:${label.includes(" ") ? `"${label}"` : label}`,
          label,
          icon: Tag,
          category: "value" as const,
        }));
    }

    // If typing a value for has:, suggest completions
    if (activeOperator === "has:") {
      const valueTyped = currentToken.slice("has:".length).toLowerCase();
      if ("attachment".startsWith(valueTyped)) {
        return [
          {
            insert: "has:attachment",
            label: "attachment",
            description: "searchSuggestions.operators.hasAttachment",
            icon: Paperclip,
            category: "value" as const,
          },
        ];
      }
      return [];
    }

    // If inside a date/field value, don't suggest
    if (activeOperator) {
      return [];
    }

    // No current token at all: show all operators
    if (!currentToken) {
      // If there's already text, also offer logic operators
      if (searchQuery.trim().length > 0) {
        return [...LOGIC_SUGGESTIONS, ...OPERATOR_SUGGESTIONS];
      }
      return OPERATOR_SUGGESTIONS;
    }

    // Filter operators that match what's being typed
    const allSuggestions =
      searchQuery.trim().length > currentToken.length
        ? [...LOGIC_SUGGESTIONS, ...OPERATOR_SUGGESTIONS]
        : OPERATOR_SUGGESTIONS;

    const filtered = allSuggestions.filter((s) =>
      s.label.toLowerCase().startsWith(lowerToken)
    );

    // Also check if typing might be a label name (after "label:")
    // or a partial operator
    if (filtered.length === 0 && lowerToken.length > 0) {
      // No operator matches - don't show suggestions for free text
      return [];
    }

    return filtered;
  }, [context, allLabels, searchQuery]);

  // Close when no suggestions or query is empty
  useEffect(() => {
    if (suggestions.length === 0) {
      setIsOpen(false);
    }
  }, [suggestions.length]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && itemRefs.current.has(selectedIndex)) {
      itemRefs.current.get(selectedIndex)?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex, isOpen]);

  const applySuggestion = useCallback(
    (suggestion: SuggestionItem) => {
      const { prefix } = context;
      const newQuery = prefix + suggestion.insert;

      // Add trailing space for completed operators/values
      // unless the insert already ends with : (waiting for value)
      const needsTrailingSpace = !suggestion.insert.endsWith(":");
      onSearchInputChange(newQuery + (needsTrailingSpace ? " " : ""));
      setIsOpen(false);

      // Refocus the input
      requestAnimationFrame(() => {
        const input = searchInputRef.current;
        if (input) {
          input.focus();
          const pos = newQuery.length + (needsTrailingSpace ? 1 : 0);
          input.setSelectionRange(pos, pos);
        }
      });
    },
    [context, onSearchInputChange, searchInputRef]
  );

  const handleInputKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) {
        // Open suggestions on any key if we have potential suggestions
        if (
          !isOpen &&
          (e.key === "ArrowDown" || e.key === "Tab") &&
          suggestions.length === 0
        ) {
          // Recalculate
          return;
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case "Tab":
        case "Enter":
          if (isOpen && suggestions.length > 0) {
            e.preventDefault();
            applySuggestion(suggestions[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, suggestions, selectedIndex, applySuggestion]
  );

  const handleInputFocus = useCallback(() => {
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  }, [suggestions.length]);

  const handleInputChange = useCallback(
    (value: string) => {
      onSearchInputChange(value);
      // Show suggestions after a short delay to avoid flash
      if (value.length > 0 || searchQuery.length > 0) {
        setIsOpen(true);
      }
    },
    [onSearchInputChange, searchQuery.length]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, searchInputRef]);

  return {
    isOpen: isOpen && suggestions.length > 0,
    suggestions,
    selectedIndex,
    handleInputKeyDown,
    handleInputFocus,
    handleInputChange,
    suggestionsRef,
    itemRefs,
    applySuggestion,
    setIsOpen,
    t,
  };
}

// ── Suggestions panel UI ────────────────────────────────────────────

export interface SuggestionsPanelProps {
  isOpen: boolean;
  suggestions: SuggestionItem[];
  selectedIndex: number;
  suggestionsRef: RefObject<HTMLDivElement | null>;
  itemRefs: RefObject<Map<number, HTMLButtonElement>>;
  applySuggestion: (suggestion: SuggestionItem) => void;
  setIsOpen: (open: boolean) => void;
  t: ReturnType<typeof useTranslations<"Viewer">>;
}

export function SuggestionsPanel({
  isOpen,
  suggestions,
  selectedIndex,
  suggestionsRef,
  itemRefs,
  applySuggestion,
  setIsOpen,
  t,
}: SuggestionsPanelProps) {
  if (!isOpen) return null;

  // Group by category
  const operators = suggestions.filter((s) => s.category === "operator");
  const values = suggestions.filter((s) => s.category === "value");

  return (
    <div
      ref={suggestionsRef}
      className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
      role="listbox"
      aria-label={t("searchSuggestions.ariaLabel")}
    >
      <div className="max-h-64 overflow-y-auto py-1">
        {values.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("searchSuggestions.groups.values")}
            </div>
            {values.map((suggestion, globalIdx) => {
              const idx = operators.length > 0 ? globalIdx : globalIdx;
              // Find the actual index in the full array
              const fullIdx = suggestions.indexOf(suggestion);
              return (
                <SuggestionRow
                  key={suggestion.insert}
                  suggestion={suggestion}
                  isSelected={selectedIndex === fullIdx}
                  onSelect={() => {
                    applySuggestion(suggestion);
                    setIsOpen(false);
                  }}
                  itemRef={(el) => {
                    if (el) {
                      itemRefs.current.set(fullIdx, el);
                    } else {
                      itemRefs.current.delete(fullIdx);
                    }
                  }}
                  t={t}
                />
              );
            })}
          </div>
        )}
        {operators.length > 0 && (
          <div>
            {values.length > 0 && (
              <div className="mx-2 my-0.5 h-px bg-border" />
            )}
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("searchSuggestions.groups.operators")}
            </div>
            {operators.map((suggestion) => {
              const fullIdx = suggestions.indexOf(suggestion);
              return (
                <SuggestionRow
                  key={suggestion.insert}
                  suggestion={suggestion}
                  isSelected={selectedIndex === fullIdx}
                  onSelect={() => {
                    applySuggestion(suggestion);
                    setIsOpen(false);
                  }}
                  itemRef={(el) => {
                    if (el) {
                      itemRefs.current.set(fullIdx, el);
                    } else {
                      itemRefs.current.delete(fullIdx);
                    }
                  }}
                  t={t}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  isSelected,
  onSelect,
  itemRef,
  t,
}: {
  suggestion: SuggestionItem;
  isSelected: boolean;
  onSelect: () => void;
  itemRef: (el: HTMLButtonElement | null) => void;
  t: ReturnType<typeof useTranslations<"Viewer">>;
}) {
  const Icon = suggestion.icon;

  return (
    <button
      ref={itemRef}
      type="button"
      role="option"
      aria-selected={isSelected}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer transition-colors",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/60 text-popover-foreground"
      )}
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent input blur
        onSelect();
      }}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">{suggestion.label}</span>
      {suggestion.description && (
        <span className="text-xs text-muted-foreground ml-auto truncate">
          {t(suggestion.description as never)}
        </span>
      )}
    </button>
  );
}
