/**
 * Advanced search query parser and evaluator.
 *
 * Supports:
 *   - Field operators: from:, to:, subject:, body:, label:
 *   - Flags: has:attachment
 *   - Date filters: before:YYYY-MM-DD, after:YYYY-MM-DD
 *   - Boolean logic: AND, OR, NOT (case-insensitive)
 *   - Parenthesis grouping: (a OR b) AND c
 *   - Quoted phrases: "exact phrase"
 *   - Bare terms (implicit AND across all searchable fields)
 */

// ── AST node types ──────────────────────────────────────────────────

export type SearchNode =
  | { type: "term"; value: string }
  | { type: "field"; field: SearchField; value: string }
  | { type: "flag"; flag: "has:attachment" }
  | { type: "date"; op: "before" | "after"; date: number } // epoch ms
  | { type: "and"; left: SearchNode; right: SearchNode }
  | { type: "or"; left: SearchNode; right: SearchNode }
  | { type: "not"; child: SearchNode };

export type SearchField =
  | "from"
  | "to"
  | "subject"
  | "body"
  | "label";

const FIELD_PREFIXES: Record<string, SearchField> = {
  "from:": "from",
  "to:": "to",
  "subject:": "subject",
  "body:": "body",
  "label:": "label",
};

// ── Tokenizer ───────────────────────────────────────────────────────

type Token =
  | { type: "WORD"; value: string }
  | { type: "QUOTED"; value: string }
  | { type: "AND" }
  | { type: "OR" }
  | { type: "NOT" }
  | { type: "LPAREN" }
  | { type: "RPAREN" }
  | { type: "FIELD"; field: SearchField; value: string }
  | { type: "FLAG"; flag: "has:attachment" }
  | { type: "DATE"; op: "before" | "after"; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    // Parentheses
    if (input[i] === "(") {
      tokens.push({ type: "LPAREN" });
      i++;
      continue;
    }
    if (input[i] === ")") {
      tokens.push({ type: "RPAREN" });
      i++;
      continue;
    }

    // Quoted string
    if (input[i] === '"') {
      let j = i + 1;
      while (j < input.length && input[j] !== '"') {
        j++;
      }
      tokens.push({ type: "QUOTED", value: input.slice(i + 1, j) });
      i = j + 1; // skip closing quote
      continue;
    }

    // Read a word (until whitespace, paren, or quote)
    let j = i;
    while (
      j < input.length &&
      !/[\s()"']/.test(input[j])
    ) {
      j++;
    }

    const word = input.slice(i, j);
    i = j;

    if (!word) continue;

    const upperWord = word.toUpperCase();

    // Boolean keywords
    if (upperWord === "AND") {
      tokens.push({ type: "AND" });
      continue;
    }
    if (upperWord === "OR") {
      tokens.push({ type: "OR" });
      continue;
    }
    if (upperWord === "NOT") {
      tokens.push({ type: "NOT" });
      continue;
    }

    // has:attachment flag
    if (word.toLowerCase() === "has:attachment") {
      tokens.push({ type: "FLAG", flag: "has:attachment" });
      continue;
    }

    // Date operators: before: / after:
    const dateLower = word.toLowerCase();
    if (dateLower.startsWith("before:") || dateLower.startsWith("after:")) {
      const colonIndex = word.indexOf(":");
      const op = dateLower.startsWith("before:") ? "before" : "after";
      let dateValue = word.slice(colonIndex + 1);

      // If value is quoted, it was already consumed; handle inline value
      if (!dateValue && i < input.length && input[i] === '"') {
        let k = i + 1;
        while (k < input.length && input[k] !== '"') k++;
        dateValue = input.slice(i + 1, k);
        i = k + 1;
      }

      if (dateValue) {
        tokens.push({ type: "DATE", op, value: dateValue });
        continue;
      }
    }

    // Field operators: from:value, to:value, etc.
    const lowerWord = word.toLowerCase();
    let matched = false;
    for (const [prefix, field] of Object.entries(FIELD_PREFIXES)) {
      if (lowerWord.startsWith(prefix)) {
        let fieldValue = word.slice(prefix.length);

        // Handle field:"quoted value"
        if (!fieldValue && i < input.length && input[i] === '"') {
          let k = i + 1;
          while (k < input.length && input[k] !== '"') k++;
          fieldValue = input.slice(i + 1, k);
          i = k + 1;
        }

        if (fieldValue) {
          tokens.push({ type: "FIELD", field, value: fieldValue });
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    // Plain word
    tokens.push({ type: "WORD", value: word });
  }

  return tokens;
}

// ── Recursive descent parser ────────────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): SearchNode | null {
    if (this.tokens.length === 0) return null;
    const node = this.parseOr();
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  // OR has the lowest precedence
  private parseOr(): SearchNode {
    let left = this.parseAnd();
    while (this.peek()?.type === "OR") {
      this.advance(); // consume OR
      const right = this.parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }

  // AND has higher precedence than OR
  private parseAnd(): SearchNode {
    let left = this.parseNot();

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (!next) break;

      // Explicit AND
      if (next.type === "AND") {
        this.advance();
        const right = this.parseNot();
        left = { type: "and", left, right };
        continue;
      }

      // Implicit AND: if next token is a primary-starting token (not OR, not RPAREN)
      if (
        next.type !== "OR" &&
        next.type !== "RPAREN"
      ) {
        const right = this.parseNot();
        left = { type: "and", left, right };
        continue;
      }

      break;
    }

    return left;
  }

  private parseNot(): SearchNode {
    if (this.peek()?.type === "NOT") {
      this.advance();
      const child = this.parseNot();
      return { type: "not", child };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): SearchNode {
    const token = this.peek();
    if (!token) {
      // Shouldn't reach here with valid input
      return { type: "term", value: "" };
    }

    if (token.type === "LPAREN") {
      this.advance(); // consume (
      const node = this.parseOr();
      if (this.peek()?.type === "RPAREN") {
        this.advance(); // consume )
      }
      return node;
    }

    if (token.type === "WORD") {
      this.advance();
      return { type: "term", value: token.value };
    }

    if (token.type === "QUOTED") {
      this.advance();
      return { type: "term", value: token.value };
    }

    if (token.type === "FIELD") {
      this.advance();
      return { type: "field", field: token.field, value: token.value };
    }

    if (token.type === "FLAG") {
      this.advance();
      return { type: "flag", flag: token.flag };
    }

    if (token.type === "DATE") {
      this.advance();
      const ts = parseDateValue(token.value);
      if (ts !== null) {
        return { type: "date", op: token.op, date: ts };
      }
      // If date is invalid, treat as a term search
      return { type: "term", value: `${token.op}:${token.value}` };
    }

    // Fall through: consume and treat as term
    this.advance();
    return { type: "term", value: "" };
  }
}

function parseDateValue(value: string): number | null {
  // Support YYYY-MM-DD
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const d = new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3])
    );
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // Support YYYY/MM/DD
  const match2 = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match2) {
    const d = new Date(
      parseInt(match2[1]),
      parseInt(match2[2]) - 1,
      parseInt(match2[3])
    );
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // Fallback: try native Date parsing
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.getTime();

  return null;
}

// ── Public API ──────────────────────────────────────────────────────

export function parseSearchQuery(input: string): SearchNode | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return null;

  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Context provided to the evaluator for a single message.
 * All string values should be lowercase for case-insensitive matching.
 */
export interface SearchContext {
  from: string;
  to: string;
  subject: string;
  body: string;
  labels: string[];
  date: number; // epoch ms
  hasAttachment: boolean;
}

/**
 * Check whether a plain text query (no operators) is being used,
 * so the worker can fast-path with simple string matching.
 */
export function isSimpleQuery(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return true;

  // If it contains any operator-like patterns, it's not simple
  const operatorPatterns = [
    /\bfrom:/i,
    /\bto:/i,
    /\bsubject:/i,
    /\bbody:/i,
    /\blabel:/i,
    /\bhas:attachment/i,
    /\bbefore:/i,
    /\bafter:/i,
    /\bAND\b/,
    /\bOR\b/,
    /\bNOT\b/,
    /[()]/,
    /"/,
  ];

  return !operatorPatterns.some((p) => p.test(trimmed));
}

/**
 * Evaluate a parsed AST against a message context.
 */
export function evaluateSearch(
  node: SearchNode,
  ctx: SearchContext
): boolean {
  switch (node.type) {
    case "term": {
      const lower = node.value.toLowerCase();
      return (
        ctx.from.includes(lower) ||
        ctx.to.includes(lower) ||
        ctx.subject.includes(lower) ||
        ctx.body.includes(lower)
      );
    }
    case "field": {
      const lower = node.value.toLowerCase();
      switch (node.field) {
        case "from":
          return ctx.from.includes(lower);
        case "to":
          return ctx.to.includes(lower);
        case "subject":
          return ctx.subject.includes(lower);
        case "body":
          return ctx.body.includes(lower);
        case "label":
          return ctx.labels.some((l) => l.includes(lower));
      }
      return false;
    }
    case "flag": {
      if (node.flag === "has:attachment") {
        return ctx.hasAttachment;
      }
      return false;
    }
    case "date": {
      if (node.op === "before") {
        return ctx.date < node.date;
      } else {
        // "after" means >= start of that day
        return ctx.date >= node.date;
      }
    }
    case "and":
      return (
        evaluateSearch(node.left, ctx) && evaluateSearch(node.right, ctx)
      );
    case "or":
      return (
        evaluateSearch(node.left, ctx) || evaluateSearch(node.right, ctx)
      );
    case "not":
      return !evaluateSearch(node.child, ctx);
  }
}
