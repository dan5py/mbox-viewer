import { ByteReader } from "~/lib/byte-reader";

export const SUPPORTED_FORMATS = {
  mbox: {
    displayName: "MBOX",
    extension: "mbox",
    mimeType: "application/mbox",
  },
} as const satisfies Record<
  string,
  { displayName: string; extension: string; mimeType: string }
>;

export type MailFileTypeId = keyof typeof SUPPORTED_FORMATS;
export type MailFileType = (typeof SUPPORTED_FORMATS)[MailFileTypeId];

export interface MailFile {
  id: string;
  name: string;
  rawFilename: string;
  typeId: MailFileTypeId;
  createdAt: Date;
  // Lazy loading fields
  fileReader?: ByteReader; // ByteReader instance
  messageBoundaries?: Array<{
    index: number;
    start: number;
    end: number;
    preview?: {
      from: string;
      to: string;
      subject: string;
      date: string;
      size: number;
      labels?: string[];
      messageId?: string;
      inReplyTo?: string;
      references?: string[];
    };
  }>;
  messageCount?: number; // Total message count
  messageCache?: Map<number, EmailMessage>; // Cache loaded messages
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  date: Date;
  rawDate: string;
  body: string;
  htmlBody?: string;
  headers: Record<string, string>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  encoding: string;
  data: string;
  contentId?: string;
}
