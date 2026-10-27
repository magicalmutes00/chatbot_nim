import { env, isNimConfigured } from "../config/env.js";
import { NimError } from "./nim.js";

/**
 * NVIDIA NIM embeddings, used for long-term memory recall.
 *
 * `nemotron-3.5-embed-1b` is asymmetric: passages (facts we store) and queries
 * (what the user just asked) must be embedded with different `input_type`s, or
 * the cosine distances degrade badly.
 */
export const EMBEDDING_MODEL = "nvidia/nemotron-3.5-embed-1b";
export const EMBEDDING_DIM = 2048;

/** The endpoint accepts long inputs, but recall quality drops; facts are short anyway. */
const MAX_EMBED_CHARS = 2_000;

type InputType = "query" | "passage";

async function embed(inputs: string[], inputType: InputType): Promise<number[][]> {
  if (!isNimConfigured) {
    throw new NimError("NVIDIA NIM API key is not configured, so memory can't be embedded.", 503);
  }
  const cleaned = inputs.map((text) => text.trim().slice(0, MAX_EMBED_CHARS));
  if (cleaned.length === 0) return [];

  const res = await fetch(`${env.nimBaseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.nimApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleaned,
      input_type: inputType,
      truncate: "END",
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new NimError(`NVIDIA NIM embeddings failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }

  const payload = (await res.json()) as { data?: Array<{ embedding?: number[]; index?: number }> };
  const rows = payload.data ?? [];
  if (rows.length !== cleaned.length) {
    throw new NimError("NVIDIA NIM returned an unexpected number of embeddings.", 502);
  }

  const vectors = rows
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((row) => row.embedding ?? []);

  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIM) {
      throw new NimError(
        `Embedding dimension mismatch: expected ${EMBEDDING_DIM}, received ${vector.length}.`,
        502,
      );
    }
  }

  return vectors;
}

export function embedQuery(text: string): Promise<number[]> {
  return embed([text], "query").then((vectors) => vectors[0]);
}

export function embedPassages(texts: string[]): Promise<number[][]> {
  return embed(texts, "passage");
}

/** pgvector accepts a string literal like `[0.1,0.2,…]`; cast it with `::vector`. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((n) => (Number.isFinite(n) ? n.toFixed(7) : "0")).join(",")}]`;
}
