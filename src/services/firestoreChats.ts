import type { Chat, ChatMessage, MessageRole } from '../types/chat';

const BACKEND_URL = 'http://localhost:8787';

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function createChat(uid: string, model: string, initialTitle = 'New chat'): Promise<string> {
  // Backend creates conversation on first message. Return a temporary id that will be replaced by backend.
  // For simplicity, return a generated id; the UI will handle conversationId from start event.
  return `temp-${Date.now()}`;
}

export async function renameChat(uid: string, chatId: string, title: string): Promise<void> {
  // Not implemented in backend; no-op
}

export async function deleteChat(uid: string, chatId: string): Promise<void> {
  await fetchJson(`${BACKEND_URL}/api/conversations/${encodeURIComponent(chatId)}`, {
    method: 'DELETE',
  });
}

export function subscribeToChats(uid: string, onChange: (chats: Chat[]) => void): () => void {
  let cancelled = false;
  const poll = async () => {
    try {
      const data = await fetchJson<{ conversations: Array<{ id: string; title: string; updatedAt: string }> }>(
        `${BACKEND_URL}/api/conversations`,
      );
      if (cancelled) return;
      const chats: Chat[] = data.conversations.map(c => ({
        id: c.id,
        title: c.title,
        model: '',
        createdAt: new Date(c.updatedAt).getTime(),
        updatedAt: new Date(c.updatedAt).getTime(),
      }));
      onChange(chats);
    } catch {}
  };
  poll();
  const interval = setInterval(poll, 5000);
  return () => { cancelled = true; clearInterval(interval); };
}

export function subscribeToMessages(
  uid: string,
  chatId: string,
  onChange: (messages: ChatMessage[]) => void,
): () => void {
  let cancelled = false;
  const poll = async () => {
    if (!chatId.startsWith('temp-')) {
      try {
        const data = await fetchJson<{ messages: Array<{ id: string; role: 'USER' | 'ASSISTANT'; content: string; source?: string; createdAt: string }> }>(
          `${BACKEND_URL}/api/conversations/${encodeURIComponent(chatId)}/messages`,
        );
        if (cancelled) return;
        const messages: ChatMessage[] = data.messages.map(m => ({
          id: m.id,
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.content,
          model: '',
          createdAt: new Date(m.createdAt).getTime(),
        }));
        onChange(messages);
      } catch {}
    } else {
      onChange([]);
    }
  };
  poll();
  const interval = setInterval(poll, 3000);
  return () => { cancelled = true; clearInterval(interval); };
}

export async function addMessage(
  uid: string,
  chatId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>,
): Promise<void> {
  // Messages are persisted by backend during streaming; no-op here
}

export async function maybeSetTitleFromFirstMessage(uid: string, chatId: string, firstUserMessage: string) {
  // Backend handles title generation
}
