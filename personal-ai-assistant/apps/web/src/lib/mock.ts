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
  {
    id: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    name: "Nemotron Super VL 120B",
    tag: "Vision",
    vision: true,
    description: "Reads images, charts, and screenshots — fast",
  },
  {
    id: "minimaxai/minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash",
    tag: "Vision · thorough",
    vision: true,
    description: "Careful image understanding for complex scenes",
  },
  {
    id: "z-ai/glm-5.3-flash",
    name: "GLM 5.3 Flash",
    tag: "GLM · slow",
    description: "Z.ai's quick model — NIM may queue it ~2 min before replying",
  },
  {
    id: "z-ai/glm-5.3",
    name: "GLM 5.3",
    tag: "GLM · slow",
    description: "Z.ai's flagship model — NIM may queue it ~4–5 min before replying",
  },
  {
    id: "black-forest-labs/flux.1-dev",
    name: "FLUX.1 Dev",
    tag: "Image",
    kind: "image",
    description: "Paints detailed, art-directed images from a prompt",
  },
];

/** Aspect presets understood by the image route. */
export const IMAGE_SIZE_OPTIONS = [
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
] as const;

export type ImageSizeOption = (typeof IMAGE_SIZE_OPTIONS)[number]["id"];

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
