/**
 * Thread/conversation grouping logic.
 *
 * Groups messages into conversation threads using:
 * 1. Message-ID / In-Reply-To / References headers (primary)
 * 2. Normalized subject fallback (secondary)
 */

interface ThreadableMessage {
  index: number;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  subject: string;
  date: string;
}

export interface ThreadGroup {
  /** Indices of messages in this thread, ordered by date (oldest first) */
  messageIndices: number[];
  /** Subject of the root/first message */
  subject: string;
  /** Date of the most recent message (for sorting threads) */
  latestDate: string;
  /** Number of messages in the thread */
  count: number;
}

/**
 * Normalize subject for fallback grouping:
 * strips Re:, Fwd:, Fw: prefixes and trims whitespace.
 */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(\s*(re|fwd?)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Build conversation thread groups from message previews.
 *
 * @param messages - Array of messages with threading metadata
 * @returns Array of ThreadGroup, sorted by latest date descending
 */
export function buildThreadGroups(
  messages: ThreadableMessage[]
): ThreadGroup[] {
  // Map message-id -> thread root id
  const messageIdToThreadId = new Map<string, string>();
  // Map thread id -> set of message indices
  const threadMembers = new Map<string, Set<number>>();
  // Track which messages are already assigned
  const assignedMessages = new Set<number>();

  // Phase 1: Group by Message-ID / In-Reply-To / References
  // Build a union-find-like structure for message IDs
  const idToRoot = new Map<string, string>();

  function findRoot(id: string): string {
    let root = id;
    while (idToRoot.has(root) && idToRoot.get(root) !== root) {
      root = idToRoot.get(root)!;
    }
    // Path compression
    let current = id;
    while (current !== root) {
      const next = idToRoot.get(current)!;
      idToRoot.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = findRoot(a);
    const rootB = findRoot(b);
    if (rootA !== rootB) {
      idToRoot.set(rootB, rootA);
    }
  }

  // First pass: register all known IDs and their relationships
  for (const msg of messages) {
    if (msg.messageId) {
      if (!idToRoot.has(msg.messageId)) {
        idToRoot.set(msg.messageId, msg.messageId);
      }

      if (msg.inReplyTo) {
        if (!idToRoot.has(msg.inReplyTo)) {
          idToRoot.set(msg.inReplyTo, msg.inReplyTo);
        }
        union(msg.inReplyTo, msg.messageId);
      }

      if (msg.references) {
        for (const ref of msg.references) {
          if (!idToRoot.has(ref)) {
            idToRoot.set(ref, ref);
          }
          union(ref, msg.messageId);
        }
      }
    }
  }

  // Second pass: assign messages to thread groups by root ID
  for (const msg of messages) {
    if (msg.messageId) {
      const root = findRoot(msg.messageId);
      messageIdToThreadId.set(msg.messageId, root);

      if (!threadMembers.has(root)) {
        threadMembers.set(root, new Set());
      }
      threadMembers.get(root)!.add(msg.index);
      assignedMessages.add(msg.index);
    }
  }

  // Also assign messages that only have inReplyTo/references but no messageId
  for (const msg of messages) {
    if (assignedMessages.has(msg.index)) continue;

    const replyId = msg.inReplyTo;
    if (replyId && idToRoot.has(replyId)) {
      const root = findRoot(replyId);
      if (!threadMembers.has(root)) {
        threadMembers.set(root, new Set());
      }
      threadMembers.get(root)!.add(msg.index);
      assignedMessages.add(msg.index);
    }
  }

  // Phase 2: Subject-based fallback for unassigned messages
  const subjectGroups = new Map<string, number[]>();
  for (const msg of messages) {
    if (assignedMessages.has(msg.index)) continue;

    const normalized = normalizeSubject(msg.subject);
    if (!normalized || normalized === "(no subject)") continue;

    if (!subjectGroups.has(normalized)) {
      subjectGroups.set(normalized, []);
    }
    subjectGroups.get(normalized)!.push(msg.index);
  }

  // Build final thread groups
  const groups: ThreadGroup[] = [];
  const messageMap = new Map<number, ThreadableMessage>();
  for (const msg of messages) {
    messageMap.set(msg.index, msg);
  }

  // From ID-based threads
  for (const [, memberSet] of threadMembers) {
    const indices = Array.from(memberSet).sort((a, b) => {
      const dateA = messageMap.get(a)?.date || "";
      const dateB = messageMap.get(b)?.date || "";
      return dateA.localeCompare(dateB);
    });

    const firstMsg = messageMap.get(indices[0]);
    const lastMsg = messageMap.get(indices[indices.length - 1]);

    groups.push({
      messageIndices: indices,
      subject: firstMsg?.subject || "(No Subject)",
      latestDate: lastMsg?.date || new Date().toISOString(),
      count: indices.length,
    });
  }

  // From subject-based groups (only if 2+ messages share a subject)
  for (const [, indices] of subjectGroups) {
    if (indices.length < 2) {
      // Single messages stay as solo threads
      const msg = messageMap.get(indices[0]);
      groups.push({
        messageIndices: indices,
        subject: msg?.subject || "(No Subject)",
        latestDate: msg?.date || new Date().toISOString(),
        count: 1,
      });
      assignedMessages.add(indices[0]);
      continue;
    }

    indices.sort((a, b) => {
      const dateA = messageMap.get(a)?.date || "";
      const dateB = messageMap.get(b)?.date || "";
      return dateA.localeCompare(dateB);
    });

    const firstMsg = messageMap.get(indices[0]);
    const lastMsg = messageMap.get(indices[indices.length - 1]);

    groups.push({
      messageIndices: indices,
      subject: firstMsg?.subject || "(No Subject)",
      latestDate: lastMsg?.date || new Date().toISOString(),
      count: indices.length,
    });

    for (const idx of indices) {
      assignedMessages.add(idx);
    }
  }

  // Remaining solo messages
  for (const msg of messages) {
    if (assignedMessages.has(msg.index)) continue;

    groups.push({
      messageIndices: [msg.index],
      subject: msg.subject || "(No Subject)",
      latestDate: msg.date || new Date().toISOString(),
      count: 1,
    });
  }

  // Sort threads by latest date descending (newest first)
  groups.sort((a, b) => b.latestDate.localeCompare(a.latestDate));

  return groups;
}
