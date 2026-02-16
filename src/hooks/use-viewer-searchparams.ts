import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

const groupingModes = ["flat", "thread"] as const;
export type GroupingMode = (typeof groupingModes)[number];

export const viewerSearchParams = {
  q: parseAsString.withDefault(""),
  label: parseAsString,
  page: parseAsInteger.withDefault(1),
  group: parseAsStringLiteral(groupingModes).withDefault("flat"),
};

export function useViewerSearchParams() {
  return useQueryStates(viewerSearchParams, {
    shallow: true,
    history: "push",
  });
}
