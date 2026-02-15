import { PREVIEWABLE_MIME_TYPES } from "~/lib/mime-types";
import { EmailAttachment } from "~/types/files";

// Format file size
export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

// Helper functions for attachment preview
export const isImageType = (mimeType: string): boolean => {
  return PREVIEWABLE_MIME_TYPES.includes(mimeType);
};

export const isPdfType = (mimeType: string): boolean => {
  return mimeType === "application/pdf";
};

export const isTextType = (mimeType: string): boolean => {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript"
  );
};

// Convert base64 to Blob - more efficient and no size limits unlike data URLs
export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const binaryData = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

export const getAttachmentDataUrl = (att: EmailAttachment): string => {
  return `data:${att.mimeType};base64,${att.data}`;
};

export const downloadAttachment = (att: EmailAttachment) => {
  try {
    let bytes: Uint8Array;

    if (att.encoding === "base64") {
      const binaryData = atob(att.data.replace(/\s/g, ""));
      bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
    } else {
      bytes = new TextEncoder().encode(att.data);
    }

    const blob = new Blob([new Uint8Array(bytes)], {
      type: att.mimeType,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = att.filename;
    a.click();
    // Delay revocation to avoid race conditions in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error("Failed to download attachment:", err);
  }
};

// Normalize "from" string to consistent format
// This ensures both preview and full message use the same format
export const normalizeFromString = (str: string): string => {
  if (!str) return "Unknown";

  // Remove extra whitespace
  str = str.trim();

  // Handle quoted names: "Name" <email@example.com> or 'Name' <email@example.com>
  // Convert to: Name <email@example.com>
  str = str.replace(/^"([^"]+)"\s*</, "$1 <");
  str = str.replace(/^'([^']+)'\s*</, "$1 <");

  // Handle case where email is in angle brackets but name might have quotes
  // "Name" <email@example.com> -> Name <email@example.com>
  str = str.replace(/"([^"]+)"\s*</g, "$1 <");
  str = str.replace(/'([^']+)'\s*</g, "$1 <");

  // Normalize multiple spaces to single space
  str = str.replace(/\s+/g, " ");

  return str;
};

// Get initials from email address or name
export const getInitials = (str: string): string => {
  if (!str) return "?";

  // Normalize the "from" string to ensure consistent formatting
  const normalized = normalizeFromString(str);

  // Try to extract name from "Name <email@example.com>" format
  let nameMatch = normalized.match(/^(.+?)\s*<.+>$/);
  if (!nameMatch) {
    // Try without angle brackets: "Name" email@example.com or Name email@example.com
    nameMatch = normalized.match(
      /^(.+?)\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    );
  }

  const name = nameMatch ? nameMatch[1].trim() : normalized.split("@")[0];

  // Remove quotes from name
  const cleanName = name.replace(/^["']|["']$/g, "").trim();

  // If name is empty or just whitespace, try to extract from email
  if (!cleanName || cleanName.length === 0) {
    const emailPart = normalized.split("@")[0];
    return emailPart.substring(0, 2).toUpperCase();
  }

  const parts = cleanName.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return cleanName.substring(0, 2).toUpperCase();
};

// Get color for avatar based on string
export const getAvatarColor = (str: string): string => {
  // Normalize the string to ensure consistent color
  const normalized = normalizeFromString(str);

  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ];
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Parse email address string into name and email
export const parseEmailAddress = (
  addressStr: string
): { name: string; email: string } => {
  if (!addressStr) return { name: "", email: "" };

  // Handle format: "Name <email@example.com>"
  const bracketMatch = addressStr.match(/^(.+?)\s*<(.+?)>$/);
  if (bracketMatch) {
    return {
      name: bracketMatch[1].trim().replace(/^["']|["']$/g, ""), // Remove quotes
      email: bracketMatch[2].trim(),
    };
  }

  // Handle format: "<email@example.com>" (no name)
  if (addressStr.startsWith("<") && addressStr.endsWith(">")) {
    return {
      name: "",
      email: addressStr.slice(1, -1).trim(),
    };
  }

  // Handle format: "email@example.com" (no name)
  if (addressStr.includes("@")) {
    return {
      name: "",
      email: addressStr.trim(),
    };
  }

  // Fallback
  return {
    name: addressStr.trim(),
    email: "",
  };
};

// Format email addresses for display (handles multiple addresses)
export const formatEmailAddresses = (
  addressesStr: string | undefined
): Array<{ name: string; email: string }> => {
  if (!addressesStr) return [];

  // Split by comma, but be careful with quoted names that might contain commas
  const addresses: Array<{ name: string; email: string }> = [];
  let current = "";
  let inQuotes = false;
  let inBrackets = 0;

  for (let i = 0; i < addressesStr.length; i++) {
    const char = addressesStr[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "<") {
      inBrackets++;
      current += char;
    } else if (char === ">") {
      inBrackets--;
      current += char;
    } else if (char === "," && !inQuotes && inBrackets === 0) {
      // Split point
      const parsed = parseEmailAddress(current.trim());
      if (parsed.email || parsed.name) {
        addresses.push(parsed);
      }
      current = "";
    } else {
      current += char;
    }
  }

  // Add the last address
  if (current.trim()) {
    const parsed = parseEmailAddress(current.trim());
    if (parsed.email || parsed.name) {
      addresses.push(parsed);
    }
  }

  return addresses.length > 0 ? addresses : [parseEmailAddress(addressesStr)];
};
