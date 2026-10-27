import { useCallback, useEffect, useRef, useState } from "react";
import {
  addTask,
  deleteTask,
  listTasks,
  patchTask,
  type TaskItem,
} from "../lib/api";
import { CheckIcon, ChecklistIcon, PlusIcon, SparkIcon, XIcon } from "./Icons";

type TasksPanelProps = {
  open: boolean;
  onClose: () => void;
  onCountChange: (open: number) => void;
};

const OPEN_STATUSES: TaskItem["status"][] = ["TODO", "IN_PROGRESS"];

function isOpen(task: TaskItem): boolean {
  return OPEN_STATUSES.includes(task.status);
}

function formatDue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function isOverdue(iso: string): boolean {
  return iso.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

function sortOpen(a: TaskItem, b: TaskItem): number {
  if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
  if (a.dueAt) return -1;
  if (b.dueAt) return 1;
  return b.createdAt.localeCompare(a.createdAt);
}

export default function TasksPanel({ open, onClose, onCountChange }: TasksPanelProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Load once per open; a failed refresh keeps whatever is already on screen.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotice(null);
    listTasks()
      .then((rows) => {
        if (!cancelled) setTasks(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load tasks.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Keep the sidebar badge honest after any local change.
  useEffect(() => {
    if (!open) return;
    onCountChange(tasks.filter(isOpen).length);
  }, [tasks, open, onCountChange]);

  const handleAdd = useCallback(async () => {
    const clean = title.trim();
    if (clean.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const task = await addTask({ title: clean, dueAt: due || null });
      setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);
      setTitle("");
      setDue("");
      setNotice("Task added.");
      titleRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that task.");
    } finally {
      setSaving(false);
    }
  }, [title, due, saving]);

  const handleToggle = useCallback(async (task: TaskItem) => {
    const nextStatus = task.status === "DONE" ? "TODO" : "DONE";
    setBusyId(task.id);
    setError(null);
    try {
      const updated = await patchTask(task.id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that task.");
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that task.");
    } finally {
      setBusyId(null);
    }
  }, []);

  if (!open) return null;

  const openTasks = tasks.filter(isOpen).sort(sortOpen);
  const doneTasks = tasks.filter((t) => !isOpen(t));

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/60 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Tasks"
        className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-ink-800 bg-ink-900 shadow-2xl shadow-black/60"
      >
        <header className="flex items-center gap-2.5 border-b border-ink-800 px-5 py-4">
          <ChecklistIcon className="size-5 text-accent-300" />
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold text-ink-100">Tasks</h2>
            <p className="text-[11px] text-ink-400">Reminders Aurora keeps for you</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tasks"
            className="ml-auto rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        {/* Add form */}
        <div className="border-b border-ink-800 px-5 py-4">
          <label
            htmlFor="task-title"
            className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-500"
          >
            Add a task
          </label>
          <div className="flex items-center gap-2">
            <input
              id="task-title"
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
              maxLength={160}
              placeholder="Renew the passport…"
              className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
            <input
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              aria-label="Due date"
              className="w-[8.25rem] shrink-0 rounded-xl border border-ink-700 bg-ink-850 px-2 py-2 text-[12px] text-ink-300 focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/20 [color-scheme:dark]"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving || title.trim().length === 0}
              aria-label="Add task"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-ink-950 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-500"
            >
              {saving ? <SparkIcon className="size-4 animate-pulse" /> : <PlusIcon className="size-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-500">
            Enter to add · dates are optional · chatting “remind me to…” also works
          </p>
        </div>

        {notice && (
          <p className="border-b border-ink-800 bg-accent-500/10 px-5 py-2 text-[12px] text-accent-200">
            {notice}
          </p>
        )}
        {error && (
          <p className="border-b border-ink-800 bg-amber-400/10 px-5 py-2 text-[12px] text-amber-200">
            {error}
          </p>
        )}

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 text-[13px] text-ink-400">
              <span className="size-1.5 animate-pulse rounded-full bg-accent-400" aria-hidden="true" />
              Loading tasks…
            </p>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl bg-ink-850 px-3.5 py-4 text-[12px] leading-relaxed text-ink-400 ring-1 ring-ink-700">
              <p className="mb-1 font-medium text-ink-200">Nothing on the list</p>
              Add one above, or tell Aurora “remind me to call the dentist tomorrow” in a chat.
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {openTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    busy={busyId === task.id}
                    onToggle={() => void handleToggle(task)}
                    onDelete={() => void handleDelete(task.id)}
                  />
                ))}
              </ul>
              {openTasks.length === 0 && (
                <p className="rounded-xl bg-ink-850 px-3.5 py-3 text-[12px] text-ink-400 ring-1 ring-ink-700">
                  All clear — nothing left to do.
                </p>
              )}
              {doneTasks.length > 0 && (
                <div className="mt-5">
                  <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-500">
                    Completed
                  </p>
                  <ul className="space-y-2">
                    {doneTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        busy={busyId === task.id}
                        onToggle={() => void handleToggle(task)}
                        onDelete={() => void handleDelete(task.id)}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="border-t border-ink-800 px-5 py-3 text-[11px] leading-snug text-ink-500">
          Open tasks are shared with the assistant so it can answer questions like “what’s on my
          list?” — they never leave your account.
        </footer>
      </aside>
    </div>
  );
}

function TaskRow({
  task,
  busy,
  onToggle,
  onDelete,
}: {
  task: TaskItem;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const done = !isOpen(task);
  const overdue = task.dueAt ? isOverdue(task.dueAt) && !done : false;

  return (
    <li
      className={`group flex items-start gap-2.5 rounded-xl bg-ink-850 px-3 py-2.5 ring-1 ring-ink-700 transition-colors hover:ring-ink-600 ${
        busy ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-label={done ? `Reopen task: ${task.title}` : `Complete task: ${task.title}`}
        aria-pressed={done}
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 ${
          done
            ? "bg-accent-500/20 text-accent-300 ring-accent-500/40"
            : "text-transparent ring-ink-600 hover:ring-ink-400"
        }`}
      >
        <CheckIcon className="size-3" />
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] leading-snug ${
            done ? "text-ink-500 line-through" : "text-ink-100"
          }`}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
          {task.dueAt && (
            <span
              className={`rounded px-1.5 py-0.5 font-medium ring-1 ${
                overdue
                  ? "bg-amber-400/10 text-amber-300 ring-amber-400/30"
                  : "bg-ink-800 text-ink-400 ring-ink-700"
              }`}
            >
              {overdue ? "Overdue · " : "Due "}
              {formatDue(task.dueAt)}
            </span>
          )}
          {task.status === "IN_PROGRESS" && (
            <span className="rounded bg-accent-500/10 px-1.5 py-0.5 font-medium text-accent-300 ring-1 ring-accent-500/20">
              In progress
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label={`Delete task: ${task.title}`}
        className="mt-0.5 shrink-0 rounded-md p-1 text-ink-500 opacity-0 transition-opacity hover:bg-ink-700 hover:text-red-300 focus-visible:opacity-100 disabled:opacity-50 group-hover:opacity-100"
      >
        <XIcon className="size-3.5" />
      </button>
    </li>
  );
}
