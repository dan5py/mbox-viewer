import { type MailFile } from "~/types/files";

export interface CommandPaletteEmailResult {
  index: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  timestamp: number | null;
  score: number;
  searchValue: string;
}

interface FieldCandidate {
  value: string;
  weight: number;
}

const RESULT_LIMIT = 24;

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenizeQuery(query: string): string[] {
  return normalizeText(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function computeSubsequenceBonus(source: string, token: string): number {
  let sourceIndex = 0;
  let tokenIndex = 0;
  let distancePenalty = 0;
  let previousMatchIndex = -1;

  while (sourceIndex < source.length && tokenIndex < token.length) {
    if (source[sourceIndex] === token[tokenIndex]) {
      if (previousMatchIndex >= 0) {
        distancePenalty += sourceIndex - previousMatchIndex - 1;
      }
      previousMatchIndex = sourceIndex;
      tokenIndex += 1;
    }
    sourceIndex += 1;
  }

  if (tokenIndex !== token.length) {
    return 0;
  }

  return Math.max(12, 40 - Math.min(distancePenalty, 28));
}

function scoreFieldValue(fieldValue: string, token: string): number {
  if (!fieldValue) {
    return 0;
  }

  if (fieldValue === token) {
    return 130;
  }

  if (fieldValue.startsWith(token)) {
    return 110;
  }

  if (new RegExp(`\\b${escapeRegExp(token)}`).test(fieldValue)) {
    return 95;
  }

  const substringIndex = fieldValue.indexOf(token);
  if (substringIndex !== -1) {
    return 75 - Math.min(substringIndex, 24);
  }

  return computeSubsequenceBonus(fieldValue, token);
}

function getRecencyBonus(timestamp: number | null): number {
  if (timestamp === null) {
    return 0;
  }

  const daysAgo = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  return Math.max(0, 18 - Math.floor(daysAgo / 30));
}

function buildSearchValue(
  subject: string,
  from: string,
  to: string,
  date: string
): string {
  return [subject, from, to, date].filter(Boolean).join(" ");
}

export function searchCommandPaletteEmails(params: {
  messageBoundaries: MailFile["messageBoundaries"];
  query: string;
  limit?: number;
}): CommandPaletteEmailResult[] {
  const { messageBoundaries, query, limit = RESULT_LIMIT } = params;
  if (!messageBoundaries || messageBoundaries.length === 0) {
    return [];
  }

  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return [];
  }

  const results: CommandPaletteEmailResult[] = [];

  for (const boundary of messageBoundaries) {
    const subject = normalizeText(boundary.preview?.subject ?? "");
    const from = normalizeText(boundary.preview?.from ?? "");
    const to = normalizeText(boundary.preview?.to ?? "");
    const date = normalizeText(boundary.preview?.date ?? "");

    const searchableFields: FieldCandidate[] = [
      { value: subject, weight: 5 },
      { value: from, weight: 4 },
      { value: to, weight: 3 },
      { value: date, weight: 1 },
    ];

    let score = 0;
    let allTokensMatched = true;

    for (const token of tokens) {
      let bestTokenScore = 0;
      for (const field of searchableFields) {
        const fieldScore = scoreFieldValue(field.value, token);
        if (fieldScore === 0) {
          continue;
        }

        const weightedScore = fieldScore * field.weight;
        if (weightedScore > bestTokenScore) {
          bestTokenScore = weightedScore;
        }
      }

      if (bestTokenScore === 0) {
        allTokensMatched = false;
        break;
      }

      score += bestTokenScore;
    }

    if (!allTokensMatched) {
      continue;
    }

    const timestamp = boundary.preview?.date
      ? Date.parse(boundary.preview.date)
      : NaN;
    const normalizedTimestamp = Number.isNaN(timestamp) ? null : timestamp;
    score += getRecencyBonus(normalizedTimestamp);

    results.push({
      index: boundary.index,
      subject: boundary.preview?.subject ?? "",
      from: boundary.preview?.from ?? "",
      to: boundary.preview?.to ?? "",
      date: boundary.preview?.date ?? "",
      timestamp: normalizedTimestamp,
      score,
      searchValue: buildSearchValue(
        boundary.preview?.subject ?? "",
        boundary.preview?.from ?? "",
        boundary.preview?.to ?? "",
        boundary.preview?.date ?? ""
      ),
    });
  }

  return results
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const timeA = a.timestamp ?? -Infinity;
      const timeB = b.timestamp ?? -Infinity;
      if (timeB !== timeA) {
        return timeB - timeA;
      }

      return a.index - b.index;
    })
    .slice(0, limit);
}
