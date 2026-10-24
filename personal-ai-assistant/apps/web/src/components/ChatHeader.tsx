import { useEffect, useState } from "react";
import { MODELS } from "../lib/mock";
import type { ModelOption } from "../lib/types";
import { CheckIcon, ChevronDownIcon } from "./Icons";

type ChatHeaderProps = {
  model: ModelOption;
  onModelChange: (model: ModelOption) => void;
  connected: boolean;
};

type Health = "checking" | "online" | "offline";

const HEALTH_STYLES: Record<Health, { dot: string; label: string }> = {
  checking: { dot: "bg-amber-400 animate-pulse", label: "Connecting…" },
  online: { dot: "bg-accent-400", label: "Server online" },
  offline: { dot: "bg-red-400/80", label: "Server offline" },
};

export default function ChatHeader({ model, onModelChange, connected }: ChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900/60 px-5 backdrop-blur">
      {/* Model selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-ink-200 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
        >
          <span className="font-medium">{model.name}</span>
          <span className="rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-accent-300 ring-1 ring-ink-700">
            {model.tag}
          </span>
          <ChevronDownIcon className={`size-3.5 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-80 rounded-2xl border border-ink-700 bg-ink-850 p-1.5 shadow-2xl shadow-black/50">
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
                Models — NVIDIA NIM
              </p>
              {MODELS.map((m) => {
                const selected = m.id === model.id;
                return (
                  <button
                    key={m.id}
                    type="button"
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
          </>
        )}
      </div>

      {/* Mode + server status */}
      <div className="flex items-center gap-2">
        {!connected && (
          <div
            className="flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300 ring-1 ring-amber-400/30"
            title="Add NEON_DATABASE_URL to server/.env for accounts and saved history"
          >
            <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            Local mode
          </div>
        )}
        <div className="flex items-center gap-2 rounded-full bg-ink-850 px-3 py-1.5 text-xs text-ink-300 ring-1 ring-ink-700">
          <span className={`size-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
          {status.label}
        </div>
      </div>
    </header>
  );
}
