import { useEffect, useRef, useState } from "react";
import { MODELS } from "../lib/mock";
import type { ModelOption } from "../lib/types";
import { apiUrl } from "../lib/config";
import { CheckIcon, ChevronDownIcon } from "./Icons";

type ChatHeaderProps = {
  model: ModelOption;
  onModelChange: (model: ModelOption) => void;
  connected: boolean;
  onMenu?: () => void;
  speechEnabled?: boolean;
  onToggleSpeech?: () => void;
};

type Health = "checking" | "online" | "offline";

const HEALTH_STYLES: Record<Health, { dot: string; label: string }> = {
  checking: { dot: "bg-amber-400 animate-pulse", label: "Connecting…" },
  online: { dot: "bg-accent-400", label: "Server online" },
  offline: { dot: "bg-red-400/80", label: "Server offline" },
};

export default function ChatHeader({ model, onModelChange, connected, onMenu, speechEnabled, onToggleSpeech }: ChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health>("checking");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // Close on an outside press. A document listener is used instead of a
    // full-viewport overlay button: the header's backdrop-blur makes it the
    // containing block for fixed children, so `fixed inset-0` only covered
    // the header strip and never caught clicks on the page.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/health"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(() => {
        if (!cancelled) setHealth("online");
      })
      .catch(() => {
        if (!cancelled) setHealth("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const status = HEALTH_STYLES[health];

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-ink-800 bg-ink-900/60 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        )}
        {/* Model selector */}
        <div className="relative min-w-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex min-w-0 max-w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-ink-200 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 sm:px-3"
          >
            <span className="truncate font-medium">{model.name}</span>
            <span className="hidden shrink-0 rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-accent-300 ring-1 ring-ink-700 sm:inline">
              {model.tag}
            </span>
            <ChevronDownIcon className={`size-3.5 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute left-0 top-[calc(100%+8px)] z-20 max-h-[min(70vh,28rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-ink-700 bg-ink-850 p-1.5 shadow-2xl shadow-black/50"
            >
                {[
                  { title: "Models — NVIDIA NIM", items: MODELS.filter((m) => (m.kind ?? "chat") === "chat") },
                  { title: "Image generation", items: MODELS.filter((m) => m.kind === "image") },
                ].map((group) =>
                  group.items.length === 0 ? null : (
                    <div key={group.title}>
                      <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
                        {group.title}
                      </p>
                      {group.items.map((m) => {
                        const selected = m.id === model.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            onClick={() => {
                              onModelChange(m);
                              setOpen(false);
                            }}
                            className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                              selected ? "bg-ink-800" : "hover:bg-ink-800/60"
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm font-medium ${selected ? "text-accent-300" : "text-ink-100"}`}>
                                {m.name}
                              </span>
                              <span className="mt-0.5 block text-xs leading-snug text-ink-400">{m.description}</span>
                            </span>
                            {selected && <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent-400" />}
                          </button>
                        );
                      })}
                    </div>
                  ),
                )}
            </div>
          )}
        </div>
      </div>

      {/* Mode + server status */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {onToggleSpeech && (
          <button
            type="button"
            onClick={onToggleSpeech}
            aria-pressed={Boolean(speechEnabled)}
            className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs ring-1 transition-colors sm:px-3 ${speechEnabled ? "bg-accent-500/10 text-accent-300 ring-accent-500/30" : "bg-ink-850 text-ink-300 ring-ink-700"}`}
            title={speechEnabled ? "Voice playback is on" : "Voice playback is off"}
          >
            <span className={`size-1.5 shrink-0 rounded-full ${speechEnabled ? "bg-accent-400" : "bg-ink-500"}`} />
            <span className="hidden sm:inline">Voice {speechEnabled ? "on" : "off"}</span>
            <span className="sr-only sm:hidden">Voice {speechEnabled ? "on" : "off"}</span>
          </button>
        )}
        {!connected && (
          <div
            className="hidden items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300 ring-1 ring-amber-400/30 sm:flex"
            title="Add NEON_DATABASE_URL to server/.env for accounts and saved history"
          >
            <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            Local mode
          </div>
        )}
        <div
          className="flex shrink-0 items-center gap-2 rounded-full bg-ink-850 px-2.5 py-1.5 text-xs text-ink-300 ring-1 ring-ink-700 sm:px-3"
          title={status.label}
        >
          <span className={`size-1.5 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
          <span className="hidden md:inline">{status.label}</span>
          <span className="sr-only md:hidden">{status.label}</span>
        </div>
      </div>
    </header>
  );
}
