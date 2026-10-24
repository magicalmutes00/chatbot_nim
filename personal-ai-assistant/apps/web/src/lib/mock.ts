import type { ModelOption } from "./types";

/**
 * Mirrors the NVIDIA NIM catalog in server/src/ai/nim.ts.
 * Phase 3 replaces this static list with live data from the backend.
 */
/**
 * Verified against the live NVIDIA NIM catalog (October 2026) — older models
 * like llama-3.3-70b hit end-of-life. Re-verify with GET /v1/models when
 * adding entries; some catalog-listed models 404 on chat completions.
 */
export const MODELS: ModelOption[] = [
  {
    id: "nvidia/nemotron-3.5-lightning-30b-a3b",
    name: "Nemotron Lightning 30B",
    tag: "Fast",
    description: "Snappy replies for everyday questions",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    name: "Nemotron Ultra 550B",
    tag: "Deep thinking",
    description: "Flagship reasoning for hard problems",
  },
];

export type ConversationGroup = "Today" | "Yesterday" | "Previous 7 days";

export interface ConversationMock {
  id: string;
  title: string;
  group: ConversationGroup;
}

/** Placeholder history — real conversations arrive with Phase 2. */
export const CONVERSATIONS: ConversationMock[] = [
  { id: "c1", title: "Aurora shell kickoff", group: "Today" },
  { id: "c2", title: "Neon vs Supabase notes", group: "Today" },
  { id: "c3", title: "NVIDIA NIM model comparison", group: "Yesterday" },
  { id: "c4", title: "Voice UX patterns research", group: "Yesterday" },
  { id: "c5", title: "Weekend trip ideas", group: "Previous 7 days" },
  { id: "c6", title: "Reading list — Q4", group: "Previous 7 days" },
  { id: "c7", title: "Portfolio redesign brainstorm", group: "Previous 7 days" },
];

export type SuggestionIcon = "spark" | "search" | "task" | "write";

export interface Suggestion {
  icon: SuggestionIcon;
  label: string;
  prompt: string;
}

export const SUGGESTIONS: Suggestion[] = [
  {
    icon: "spark",
    label: "Summarize my notes",
    prompt: "Summarize the notes I saved yesterday into three key points.",
  },
  {
    icon: "search",
    label: "Research a topic",
    prompt: "Research the latest on NVIDIA NIM speech models and give me a short brief.",
  },
  {
    icon: "task",
    label: "Plan my day",
    prompt: "Help me plan a focused 4-hour work block this morning.",
  },
  {
    icon: "write",
    label: "Draft a message",
    prompt: "Draft a friendly message to a collaborator about the Aurora project timeline.",
  },
];
