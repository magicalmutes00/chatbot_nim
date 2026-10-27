export type Role = "user" | "assistant";

export interface MessageImage {
  /** Storage key — absent for locally attached previews. */
  key?: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  /** Set when streaming failed — shown as an inline error card. */
  error?: string;
  voicePlayed?: boolean;
  images?: MessageImage[];
  /** How many long-term memories were folded into this reply's context. */
  memoriesUsed?: number;
  /** Tasks extracted from the user's message during this turn. */
  tasksCreated?: { id: string; title: string; dueAt: string | null }[];
}

export type ModelKind = "chat" | "image";

export interface ModelOption {
  id: string;
  name: string;
  tag: string;
  description: string;
  /** Model can read image attachments. */
  vision?: boolean;
  /** Chat models stream text; image models paint a picture. */
  kind?: ModelKind;
}

export interface Attachment {
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Local object URL used for thumbnail previews (never sent to the server). */
  previewUrl?: string;
}
