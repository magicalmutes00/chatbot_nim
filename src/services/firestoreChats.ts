import type { Chat, ChatMessage } from '../types/chat';
import { backendFetch } from '../api/backend';
import { getImageAspect } from './imageAspects';

interface ApiMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  model?: string | null;
  source?: string;
  createdAt: string;
  attachments?: Array<{ key: string; url: string; mimeType: string }>;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await backendFetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function createChat(_uid: string, _model: string, _initialTitle = 'New chat'): Promise<string> {
  // The backend creates the conversation from the first chat turn; this is a
  // placeholder id that ChatScreen swaps for the real one on the `start` event.
  return `temp-${Date.now()}`;
}

export async function renameChat(_uid: string, _chatId: string, _title: string): Promise<void> {
  // Titles are derived from the first message by the backend; no-op.
}

export async function deleteChat(_uid: string, chatId: string): Promise<void> {
  await fetchJson(`/api/conversations/${encodeURIComponent(chatId)}`, {
    method: 'DELETE',
  });
}

export function subscribeToChats(_uid: string, onChange: (chats: Chat[]) => void): () => void {
  let cancelled = false;
  const poll = async () => {
    try {
      const data = await fetchJson<{ conversations: Array<{ id: string; title: string; updatedAt: string }> }>(
        '/api/conversations',
      );
      if (cancelled) return;
      const chats: Chat[] = data.conversations.map((c) => ({
        id: c.id,
        title: c.title,
        model: '',
        createdAt: new Date(c.updatedAt).getTime(),
        updatedAt: new Date(c.updatedAt).getTime(),
      }));
      onChange(chats);
    } catch {
      // Keep the last good list; the next poll may recover.
    }
  };
  poll();
  const interval = setInterval(poll, 5000);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}

export function subscribeToMessages(
  _uid: string,
  chatId: string,
  onChange: (messages: ChatMessage[]) => void,
): () => void {
  let cancelled = false;
  const poll = async () => {
    if (chatId.startsWith('temp-')) {
      onChange([]);
      return;
    }
    try {
      const data = await fetchJson<{ messages: ApiMessage[] }>(
        `/api/conversations/${encodeURIComponent(chatId)}/messages`,
      );
      if (cancelled) return;
      const messages: ChatMessage[] = data.messages.map((m) => {
        const image = m.attachments?.find((a) => a.mimeType.startsWith('image/'));
        const aspect = image ? getImageAspect(image.key) : undefined;
        return {
          id: m.id,
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.content,
          model: m.model ?? '',
          createdAt: new Date(m.createdAt).getTime(),
          ...(image ? { imageUri: image.url } : {}),
          // Presigned URLs carry no dimensions; this remembers sizes rendered
          // in this session so landscape art is not cropped to a square.
          ...(aspect ? { imageAspect: aspect } : {}),
        };
      });
      onChange(messages);
    } catch {
      // Keep the last good history; the next poll may recover.
    }
  };
  poll();
  const interval = setInterval(poll, 3000);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}

export async function addMessage(
  _uid: string,
  _chatId: string,
  _message: Omit<ChatMessage, 'id' | 'createdAt'>,
): Promise<void> {
  // Messages are persisted by the backend during `/api/chat`; no-op here.
}

export async function maybeSetTitleFromFirstMessage(
  _uid: string,
  _chatId: string,
  _firstUserMessage: string,
) {
  // The backend derives the conversation title from its first user turn.
}
