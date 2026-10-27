import { useCallback, useEffect, useRef, useState } from "react";
import {
  addMemory,
  deleteMemory,
  listMemories,
  setAutoRemember,
  type MemoryItem,
} from "../lib/api";
import { BrainIcon, PlusIcon, SparkIcon, XIcon } from "./Icons";

type MemoryPanelProps = {
  open: boolean;
  onClose: () => void;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MemoryPanel({ open, onClose }: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [autoRemember, setAutoRememberState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load once per open. Kept separate from the list so a failed refresh leaves
  // whatever was already on screen visible.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotice(null);
    listMemories()
      .then((res) => {
        if (cancelled) return;
        setMemories(res.memories);
        setAutoRememberState(res.autoRemember);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load memories.");
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

  const handleAdd = useCallback(async () => {
    const content = draft.trim();
    if (content.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await addMemory(content);
      setMemories((prev) =>
        res.duplicate ? prev : [res.memory, ...prev.filter((m) => m.id !== res.memory.id)],
      );
      setDraft("");
      setNotice(res.duplicate ? "You already have that one saved." : "Saved to memory.");
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that memory.");
    } finally {
      setSaving(false);
    }
  }, [draft, saving]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that memory.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleToggleAuto = useCallback(async () => {
    const next = !autoRemember;
    setAutoRememberState(next);
    setError(null);
    try {
      await setAutoRemember(next);
    } catch (err) {
      setAutoRememberState(!next);
      setError(err instanceof Error ? err.message : "Could not update that setting.");
    }
  }, [autoRemember]);

  if (!open) return null;

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
        aria-label="Memory"
        className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-ink-800 bg-ink-900 shadow-2xl shadow-black/60"
      >
        <header className="flex items-center gap-2.5 border-b border-ink-800 px-5 py-4">
          <BrainIcon className="size-5 text-accent-300" />
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-semibold text-ink-100">Memory</h2>
            <p className="text-[11px] text-ink-400">Facts Aurora keeps across conversations</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close memory"
            className="ml-auto rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        {/* Auto-remember toggle */}
        <div className="flex items-start gap-3 border-b border-ink-800 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-100">Learn automatically</p>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-400">
              Aurora saves durable details from your chats. Turn this off to only keep what you add
              yourself.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoRemember}
            aria-label="Learn automatically"
            onClick={() => void handleToggleAuto()}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 ${
              autoRemember ? "bg-accent-500" : "bg-ink-700"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
                autoRemember ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Add form */}
        <div className="border-b border-ink-800 px-5 py-4">
          <label htmlFor="memory-draft" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-500">
            Add a fact
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="memory-draft"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
              rows={2}
              maxLength={400}
              placeholder="I prefer short answers…"
              className="min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-[13px] leading-snug text-ink-100 placeholder:text-ink-500 focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving || draft.trim().length === 0}
              aria-label="Save memory"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-ink-950 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-500"
            >
              {saving ? <SparkIcon className="size-4 animate-pulse" /> : <PlusIcon className="size-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-500">Enter to save · Shift+Enter for a new line</p>
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
              Loading memory…
            </p>
          ) : memories.length === 0 ? (
            <div className="rounded-xl bg-ink-850 px-3.5 py-4 text-[12px] leading-relaxed text-ink-400 ring-1 ring-ink-700">
              <p className="mb-1 font-medium text-ink-200">Nothing remembered yet</p>
              Facts you add here, and details Aurora picks up from chats, will show up so you can
              review or delete them.
            </div>
          ) : (
            <ul className="space-y-2">
              {memories.map((memory) => (
                <li
                  key={memory.id}
                  className="group rounded-xl bg-ink-850 px-3.5 py-2.5 ring-1 ring-ink-700 transition-colors hover:ring-ink-600"
                >
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-100">
                      {memory.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleDelete(memory.id)}
                      disabled={deletingId === memory.id}
                      aria-label="Delete memory"
                      className="mt-0.5 shrink-0 rounded-md p-1 text-ink-500 opacity-0 transition-opacity hover:bg-ink-700 hover:text-red-300 focus-visible:opacity-100 disabled:opacity-50 group-hover:opacity-100"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-ink-500">
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium ring-1 ${
                        memory.source === "MANUAL"
                          ? "bg-ink-800 text-ink-300 ring-ink-700"
                          : "bg-accent-500/10 text-accent-300 ring-accent-500/20"
                      }`}
                    >
                      {memory.source === "MANUAL" ? "Added" : "Learned"}
                    </span>
                    <span className="normal-case tracking-normal text-ink-500">
                      {formatDate(memory.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-ink-800 px-5 py-3 text-[11px] leading-snug text-ink-500">
          Only facts relevant to your message are used in a reply, and they never leave your
          account.
        </footer>
      </aside>
    </div>
  );
}
