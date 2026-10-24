import type { ChatMessage } from "./types";

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

export interface StoredMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  source: string;
  createdAt: string;
}

export interface StreamCallbacks {
  onStart?: (conversationId: string) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

// ── Helpers ──────────────────────────────────────────────

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
    const res = await fetch("/api/health");
    if (!res.ok) return null;
    return (await res.json()) as HealthInfo;
  } catch {
    return null;
  }
}

// ── Conversations ────────────────────────────────────────

export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await fetch("/api/conversations");
  if (!res.ok) throw await parseError(res, "Could not load conversations.");
  const data = (await res.json()) as { conversations?: ConversationSummary[] };
  return data.conversations ?? [];
}

export async function fetchConversationMessages(id: string): Promise<StoredMessage[]> {
  const res = await fetch(`/api/conversations/${id}/messages`);
  if (!res.ok) throw await parseError(res, "Could not load the conversation.");
  const data = (await res.json()) as { messages?: StoredMessage[] };
  return data.messages ?? [];
}

export async function removeConversation(id: string): Promise<void> {
  const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res, "Could not delete the conversation.");
}

// ── Chat streaming ───────────────────────────────────────

export async function streamChat(
  {
    messages,
    model,
    conversationId,
    source = "typed",
    signal,
  }: {
    messages: ChatMessage[];
    model: string;
    conversationId: string | null;
    source?: "typed" | "voice";
    signal: AbortSignal;
  },
  cb: StreamCallbacks,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      conversationId: conversationId ?? undefined,
      source,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
          text?: string;
          message?: string;
        };
        if (event === "start" && typeof payload.conversationId === "string") {
          cb.onStart?.(payload.conversationId);
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
