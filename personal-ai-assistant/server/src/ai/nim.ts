import { env, isNimConfigured } from "../config/env.js";

/**
 * NVIDIA NIM exposes an OpenAI-compatible API, so the same client code
 * works for chat completions and embeddings.
 */
export const nim = {
  baseUrl: env.nimBaseUrl,
  configured: isNimConfigured,
} as const;

export const NIM_MODELS = [
  {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    label: "Nemotron Lightning 30B",
    tag: "Fast",
    thinking: false,
    maxTokens: 2048,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    label: "Nemotron Ultra 550B",
    tag: "Deep thinking",
    thinking: true,
    maxTokens: 8192,
  },
] as const;

type ModelMeta = (typeof NIM_MODELS)[number];

export type ChatRole = "system" | "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export class NimError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "NimError";
  }
}

/**
 * Streams a chat completion from NVIDIA NIM (OpenAI-compatible SSE).
 * Yields text deltas as they arrive.
 */
export async function* streamChat(opts: {
  model: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  onUsage?: (usage: { tokensIn: number; tokensOut: number }) => void;
}): AsyncGenerator<string, void, undefined> {
  if (!isNimConfigured) {
    throw new NimError(
      "NVIDIA NIM API key is not configured. Add NVIDIA_NIM_API_KEY to server/.env and restart the server — until then Aurora can't reach the models.",
      503,
    );
  }

  const meta = NIM_MODELS.find((m) => m.id === opts.model) as ModelMeta | undefined;
  const maxTokens = opts.maxTokens ?? meta?.maxTokens ?? 2048;
  // Reasoning models burn tokens (and seconds) on hidden reasoning first.
  // "Fast" models run with thinking disabled for snappy replies.
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: opts.temperature ?? 0.7,
    max_tokens: maxTokens,
  };
  if (meta ? !meta.thinking : true) {
    body.chat_template_kwargs = { thinking: false };
  }

  const res = await fetch(`${env.nimBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.nimApiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new NimError(`NVIDIA NIM request failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
          if (chunk.usage) {
            opts.onUsage?.({
              tokensIn: chunk.usage.prompt_tokens ?? 0,
              tokensOut: chunk.usage.completion_tokens ?? 0,
            });
          }
        } catch {
          // Ignore malformed / keep-alive lines.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
