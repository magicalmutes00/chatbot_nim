import { env, isNimConfigured } from "../config/env.js";
import { MAX_TASK_TITLE_CHARS, type TaskDraft } from "./store.js";

/**
 * Turns explicit "remind me to..." style messages into tasks.
 *
 * This runs before the stream starts, so it is gated by `looksLikeTaskRequest`
 * — most messages never pay for an extra model call. A miss just means the
 * user uses the Tasks panel instead; a failure never blocks the reply.
 */

const EXTRACTION_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
const EXTRACTION_TIMEOUT_MS = 12_000;
const MAX_TASKS_PER_MESSAGE = 3;

const GATE_PATTERNS = [
  /\bremind me\b/i,
  /\b(add|create|make|new)\b[^.?!\n]{0,24}\btask\b/i,
  /\bto-?do\b/i,
  /\bdon'?t forget\b/i,
  /\bremember to\b/i,
  /\b(add|put)\b[^.?!\n]{0,40}\b(on|to) (my|the) (list|to-?do)\b/i,
  /\bi (need|have|ought) to\b/i,
  /\bi (really )?should\b/i,
  /\breminder\b/i,
  /\bdeadline\b/i,
];

/** Cheap local filter so ordinary chat does not make an extra NIM call. */
export function looksLikeTaskRequest(text: string): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 12) return false;
  return GATE_PATTERNS.some((pattern) => pattern.test(clean));
}

/** Calendar date for a timezone, as YYYY-MM-DD. Falls back to UTC. */
export function todayInTimezone(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const year = pick("year");
    const month = pick("month");
    const day = pick("day");
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Unknown timezone — fall through to UTC.
  }
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDueDate(value: unknown, todayIso: string): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const year = Number(value.slice(0, 4));
  const currentYear = Number(todayIso.slice(0, 4));
  if (!Number.isFinite(year) || year < currentYear - 10 || year > currentYear + 10) return null;
  return date;
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
  if (title.length < 2 || title.length > MAX_TASK_TITLE_CHARS) return null;
  if (/^the user\b/i.test(title)) return null;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function buildPrompt(todayIso: string): string {
  const tomorrow = addDays(todayIso, 1);
  return `You turn a message into tasks for a personal assistant's to-do list.

Today is ${todayIso}. Tomorrow is ${tomorrow}.

Rules:
- Create a task only when the user asks to be reminded, asks to add something to a list, or states a concrete commitment with a deadline.
- Do not create tasks for questions, general plans, or vague intentions.
- Titles are short imperatives under 120 characters, without "The user" and without a trailing period.
- dueDate is YYYY-MM-DD only when the user names a day; otherwise null. Never invent a date.
- If nothing qualifies, return {"tasks": []}.

Examples:

User: "Remind me to call the dentist tomorrow."
Output: {"tasks": [{"title": "Call the dentist", "dueDate": "${tomorrow}"}]}

User: "I need to renew my passport by 15 December 2026."
Output: {"tasks": [{"title": "Renew passport", "dueDate": "2026-12-15"}]}

User: "I'm thinking about learning guitar someday."
Output: {"tasks": []}

User: "What's on my list?"
Output: {"tasks": []}

Now read the message. Respond with JSON only, no prose or code fences:
{"tasks": [{"title": "...", "dueDate": "YYYY-MM-DD" or null}]}`;
}

function readJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
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

interface ExtractResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function extractTasks(userText: string, todayIso: string): Promise<TaskDraft[]> {
  if (!isNimConfigured) return [];

  const res = await fetch(`${env.nimBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.nimApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      messages: [
        { role: "system", content: buildPrompt(todayIso) },
        { role: "user", content: userText.slice(0, 4_000) },
      ],
      temperature: 0.1,
      max_tokens: 400,
      stream: false,
      chat_template_kwargs: { thinking: false },
    }),
    signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
  });
  if (!res.ok) return [];

  const payload = (await res.json()) as ExtractResponse;
  const text = payload.choices?.[0]?.message?.content ?? "";
  if (!text) return [];

  const parsed = readJson(text) as { tasks?: unknown } | null;
  if (!Array.isArray(parsed?.tasks)) return [];

  const seen = new Set<string>();
  const drafts: TaskDraft[] = [];
  for (const item of parsed.tasks) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as { title?: unknown; dueDate?: unknown };
    const title = cleanTitle(row.title);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push({ title, dueAt: parseDueDate(row.dueDate, todayIso) });
    if (drafts.length >= MAX_TASKS_PER_MESSAGE) break;
  }
  return drafts;
}
