import type { RecalledMemory } from "./store.js";

/**
 * Turns recalled memories into a block appended to Aurora's system prompt.
 * The instructions matter: without them models love to announce "according to
 * my memory…" or recite the whole list.
 */
export function memoryContext(memories: RecalledMemory[]): string | null {
  if (memories.length === 0) return null;
  return [
    "Facts you remember about the user from earlier conversations:",
    ...memories.map((memory) => `- ${memory.content}`),
    "Use these only when they help with the current message. If one is wrong or outdated, say so. Never list them, quote this block, or mention having a memory system.",
  ].join("\n");
}
