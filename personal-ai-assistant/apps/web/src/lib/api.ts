import type { ChatMessage } from "./types";
import { apiUrl } from "./config";
import { getIdToken } from "./auth";

// ── Types ────────────────────────────────────────────────

export interface HealthInfo {
  database: boolean;
  nim: { configured: boolean };
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredAttachment {
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StoredMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  source: string;
  model?: string | null;
  createdAt: string;
  attachments?: StoredAttachment[];
}

export interface StreamCallbacks {
  onStart?: (conversationId: string, memoriesUsed: number, openTasks: number) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  /** Tasks the server pulled out of the user's message, sent after `done`. */
  onTasks?: (tasks: TaskItem[], open: number) => void;
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Fetches an Aurora API route with the current Firebase ID token.
 *
 * The server verifies the token on every request (there are no cookies), so
 * every authenticated call — including the streaming chat POST — must go
 * through here rather than the global `fetch`.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  try {
    const data = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof data?.error === "string") return new Error(data.error);
    if (typeof data?.message === "string") return new Error(data.message);
  } catch {
    // fall through to fallback
  }
  return new Error(fallback);
}

// ── Health ───────────────────────────────────────────────

export async function fetchHealth(): Promise<HealthInfo | null> {
  try {
    const res = await fetch(apiUrl("/api/health"));
    if (!res.ok) return null;
    return (await res.json()) as HealthInfo;
  } catch {
    return null;
  }
}

// ── Conversations ────────────────────────────────────────

export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await apiFetch("/api/conversations");
  if (!res.ok) throw await parseError(res, "Could not load conversations.");
  const data = (await res.json()) as { conversations?: ConversationSummary[] };
  return data.conversations ?? [];
}

export async function fetchConversationMessages(id: string): Promise<StoredMessage[]> {
  const res = await apiFetch(`/api/conversations/${id}/messages`);
  if (!res.ok) throw await parseError(res, "Could not load the conversation.");
  const data = (await res.json()) as { messages?: StoredMessage[] };
  return data.messages ?? [];
}

export async function removeConversation(id: string): Promise<void> {
  const res = await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res, "Could not delete the conversation.");
}

// ── Image generation ─────────────────────────────────────

export interface GeneratedImage {
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export async function generateImage({
  prompt,
  model,
  conversationId,
  size,
  signal,
}: {
  prompt: string;
  model: string;
  conversationId: string | null;
  size: string;
  signal: AbortSignal;
}): Promise<{ conversationId: string; messageId: string; image: GeneratedImage }> {
  const res = await apiFetch("/api/images/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      model,
      size,
      conversationId: conversationId ?? undefined,
    }),
    signal,
  });
  if (!res.ok) throw await parseError(res, `Image generation failed (${res.status})`);
  return (await res.json()) as { conversationId: string; messageId: string; image: GeneratedImage };
}

// ── Long-term memory ─────────────────────────────────────

export interface MemoryItem {
  id: string;
  content: string;
  source: "MANUAL" | "AUTO";
  createdAt: string;
}

export async function listMemories(): Promise<{ memories: MemoryItem[]; autoRemember: boolean }> {
  const res = await apiFetch("/api/memories");
  if (!res.ok) throw await parseError(res, `Could not load memories (${res.status})`);
  return (await res.json()) as { memories: MemoryItem[]; autoRemember: boolean };
}

export async function addMemory(content: string): Promise<{ memory: MemoryItem; duplicate: boolean }> {
  const res = await apiFetch("/api/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw await parseError(res, `Could not save that memory (${res.status})`);
  return (await res.json()) as { memory: MemoryItem; duplicate: boolean };
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await apiFetch(`/api/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res, `Could not delete that memory (${res.status})`);
}

export async function setAutoRemember(autoRemember: boolean): Promise<{ autoRemember: boolean }> {
  const res = await apiFetch("/api/memories/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoRemember }),
  });
  if (!res.ok) throw await parseError(res, `Could not update memory settings (${res.status})`);
  return (await res.json()) as { autoRemember: boolean };
}

// ── Tasks & reminders ────────────────────────────────────

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  /** ISO timestamp; date-only values are stored at noon UTC. */
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listTasks(): Promise<TaskItem[]> {
  const res = await apiFetch("/api/tasks");
  if (!res.ok) throw await parseError(res, `Could not load tasks (${res.status})`);
  const data = (await res.json()) as { tasks?: TaskItem[] };
  return data.tasks ?? [];
}

export async function countOpenTasks(): Promise<number> {
  const res = await apiFetch("/api/tasks/count");
  if (!res.ok) throw await parseError(res, `Could not count tasks (${res.status})`);
  const data = (await res.json()) as { open?: number };
  return typeof data.open === "number" ? data.open : 0;
}

export async function addTask(input: {
  title: string;
  description?: string | null;
  dueAt?: string | null;
}): Promise<TaskItem> {
  const res = await apiFetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res, `Could not add that task (${res.status})`);
  const data = (await res.json()) as { task: TaskItem };
  return data.task;
}

export async function patchTask(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    dueAt?: string | null;
    status?: TaskStatus;
  },
): Promise<TaskItem> {
  const res = await apiFetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await parseError(res, `Could not update that task (${res.status})`);
  const data = (await res.json()) as { task: TaskItem };
  return data.task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res, `Could not delete that task (${res.status})`);
}

// ── Chat streaming ───────────────────────────────────────

export async function streamChat(
  {
    messages,
    model,
    conversationId,
    source = "typed",
    signal,
    attachments,
    timezone,
  }: {
    messages: ChatMessage[];
    model: string;
    conversationId: string | null;
    source?: "typed" | "voice";
    signal: AbortSignal;
    attachments?: { key: string; filename: string; mimeType: string; sizeBytes: number }[];
    /** IANA zone, so "tomorrow" means the user's calendar day. */
    timezone?: string;
  },
  cb: StreamCallbacks,
): Promise<void> {
  const res = await apiFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      conversationId: conversationId ?? undefined,
      source,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(attachments?.length ? { attachments } : {}),
      ...(timezone ? { timezone } : {}),
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data?.error === "string") message = data.error;
    } catch {
      // keep default message
    }
    cb.onError(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = "message";
      let data: string | null = null;
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      if (data === null) continue;

      try {
        const payload = JSON.parse(data) as {
          conversationId?: string;
          memories?: number;
          tasks?: unknown;
          open?: number;
          text?: string;
          message?: string;
        };
        if (event === "start" && typeof payload.conversationId === "string") {
          cb.onStart?.(
            payload.conversationId,
            typeof payload.memories === "number" ? payload.memories : 0,
            typeof payload.tasks === "number" ? payload.tasks : 0,
          );
        } else if (event === "tasks" && Array.isArray(payload.tasks)) {
          cb.onTasks?.(
            payload.tasks as TaskItem[],
            typeof payload.open === "number" ? payload.open : 0,
          );
        } else if (event === "delta" && typeof payload.text === "string") {
          cb.onDelta(payload.text);
        } else if (event === "done") {
          cb.onDone();
        } else if (event === "error") {
          cb.onError(payload.message ?? "Unknown streaming error.");
        }
      } catch {
        // ignore malformed frames
      }
    }
  }
}
