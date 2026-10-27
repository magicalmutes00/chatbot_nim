export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoningContent?: string; // optional, from NIM's `reasoning_content`
  imageUri?: string; // data URI or URL — set when an image model produced the reply
  imageAspect?: number; // width/height of the generated image, for display
  model: string;
  createdAt: number; // ms epoch, mirrors Firestore serverTimestamp on read
}

/** Metadata for a file already stored in S3 (see `POST /api/attachments/upload-url`). */
export interface ChatAttachment {
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
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
