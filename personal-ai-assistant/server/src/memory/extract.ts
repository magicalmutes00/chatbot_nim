import { env, isNimConfigured } from "../config/env.js";
import { addMemory, getMemorySettings, listMemories } from "./store.js";

/**
 * After a turn, a small fast model decides whether anything durable was said.
 * This is best-effort background work: every failure path returns quietly so a
 * hiccup in extraction never surfaces to the user or breaks the stream.
 */
const EXTRACTION_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const EXTRACTION_TIMEOUT_MS = 25_000;
const MAX_FACTS_PER_TURN = 3;

const SYSTEM_PROMPT = `You extract long-term memory facts about the user from a chat exchange.

Rules:
- Save durable details: name, location, job, languages, family, lasting preferences, health, projects, important dates.
- Skip small talk, one-off requests, temporary moods, anything about the assistant, and secrets like passwords or card numbers.
- One fact per item, third person, starting with "The user", under 200 characters.
- If an "Already known" list is included, never restate or rephrase those facts; only return new information.
- If nothing durable or new is said, return {"memories": []}.

Examples:

User said: "I'm Priya, a nurse in Leeds. I hate coriander."
Assistant replied: "Nice to meet you, Priya."
Output: {"memories": ["The user's name is Priya.", "The user works as a nurse in Leeds.", "The user dislikes coriander."]}

User said: "What's the weather like tomorrow?"
Assistant replied: "It should be sunny and 24C."
Output: {"memories": []}

Now read this exchange. Respond with JSON only, no prose or code fences.`;

const KNOWN_PREFIX = "Already known facts (do not repeat these):";

interface ExtractResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function readJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Models occasionally wrap the object in a sentence; take the outermost braces.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

const SECRET_HINTS = /(password|passcode|api[\s_-]?key|secret|token|credit card|debit card|\bssn\b|social security|iban|routing number)/i;

function isUsable(fact: unknown): fact is string {
  if (typeof fact !== "string") return false;
  const clean = fact.replace(/\s+/g, " ").trim();
  if (clean.length < 8 || clean.length > 300) return false;
  if (!/^the user\b/i.test(clean)) return false;
  if (SECRET_HINTS.test(clean)) return false;
  return true;
}

export async function extractMemories(turn: {
  userText: string;
  assistantText: string;
  known?: string[];
}): Promise<string[]> {
  if (!isNimConfigured) return [];

  const known = (turn.known ?? []).slice(0, 120);
  const knownBlock =
    known.length > 0 ? `${KNOWN_PREFIX}\n${known.map((fact) => `- ${fact}`).join("\n")}\n\n` : "";

  const body = {
    model: EXTRACTION_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${knownBlock}User said:\n${turn.userText.slice(0, 4_000)}\n\nAssistant replied:\n${turn.assistantText.slice(0, 2_000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 400,
    stream: false,
    chat_template_kwargs: { thinking: false },
  };

  const res = await fetch(`${env.nimBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.nimApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
  });
  if (!res.ok) return [];

  const payload = (await res.json()) as ExtractResponse;
  const text = payload.choices?.[0]?.message?.content ?? "";
  if (!text) return [];

  const parsed = readJson(text) as { memories?: unknown } | null;
  const list = parsed?.memories;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const facts: string[] = [];
  for (const item of list) {
    if (!isUsable(item)) continue;
    const clean = item.replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push(clean);
    if (facts.length >= MAX_FACTS_PER_TURN) break;
  }
  return facts;
}

/** Fire-and-forget: extract facts from a finished turn and persist them. */
export async function rememberFromTurn(
  userId: string,
  turn: { userText: string; assistantText: string },
): Promise<void> {
  try {
    const { autoRemember } = await getMemorySettings(userId);
    if (!autoRemember) return;
    if (turn.userText.trim().length < 12) return;

    // Showing the extractor what is already saved is what actually prevents
    // duplicates — short-fact embeddings are too close for a cosine cutoff.
    const known = (await listMemories(userId, 120)).map((memory) => memory.content);
    const facts = await extractMemories({ ...turn, known });
    for (const fact of facts) {
      await addMemory(userId, fact, "AUTO");
    }
  } catch {
    // Best-effort by design.
  }
}
