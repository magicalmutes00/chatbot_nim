export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  /** Set when streaming failed — shown as an inline error card. */
  error?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  tag: string;
  description: string;
}
