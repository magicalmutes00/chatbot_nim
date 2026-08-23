export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoningContent?: string; // optional, from NIM's `reasoning_content`
  model: string;
  createdAt: number; // ms epoch, mirrors Firestore serverTimestamp on read
}

export interface Chat {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface NimChatCompletionRequest {
  model: string;
  messages: { role: MessageRole | 'system'; content: string }[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}
