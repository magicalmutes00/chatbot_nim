import type { TaskRecord } from "./store.js";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Compact task list for the chat system prompt. The instructions matter: models
 * like to recite lists or announce that they checked a database.
 */
export function tasksContext(tasks: TaskRecord[], todayIso: string): string | null {
  if (tasks.length === 0) return null;

  const lines = tasks.map((task) => {
    const title = task.title.length > 120 ? `${task.title.slice(0, 117)}...` : task.title;
    if (!task.dueAt) return `- [ ] ${title}`;
    const due = isoDate(task.dueAt);
    return `- [ ] ${title} (due ${due}${due < todayIso ? ", overdue" : ""})`;
  });

  return [
    "The user's open tasks, most urgent first:",
    ...lines,
    "Reference a task only when it helps with the current message. Do not read this list aloud, and do not claim to have completed or changed a task.",
  ].join("\n");
}
