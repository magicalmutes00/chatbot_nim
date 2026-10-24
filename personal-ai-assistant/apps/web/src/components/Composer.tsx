import { useEffect, useRef, useState } from "react";
import { MicIcon, PaperclipIcon, SendIcon, StopIcon } from "./Icons";

type ComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
};

export default function Composer({ draft, onDraftChange, onSend, onStop, streaming }: ComposerProps) {
  // Visual listening state only — real speech recognition arrives in Phase 4.
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text || streaming) return;
    onSend(text);
  };

  return (
    <div className="shrink-0 px-6 pb-5 pt-2">
      <div className="mx-auto max-w-3xl">
        {listening && (
          <div className="mb-2.5 flex justify-center">
            <button
              type="button"
              onClick={() => setListening(false)}
              className="flex items-center gap-2.5 rounded-full bg-accent-500/10 px-3.5 py-1.5 text-xs font-medium text-accent-300 ring-1 ring-accent-500/30 transition-colors hover:bg-accent-500/15"
            >
              <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="eq-bar h-3 w-[3px] rounded-full bg-accent-400"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </span>
              Listening — click to stop
            </button>
          </div>
        )}

        <div
          className={`relative flex items-end gap-1.5 rounded-2xl bg-ink-850 p-2.5 ring-1 transition-all ${
            listening
              ? "ring-accent-500/70 shadow-[0_0_0_4px_rgb(23_201_154/0.12)]"
              : "ring-ink-700 focus-within:ring-ink-500"
          }`}
        >
          <button
            type="button"
            aria-label="Attach files"
            title="Attach files — Phase 7"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
          >
            <PaperclipIcon className="size-[18px]" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            placeholder={listening ? "Listening…" : "Ask Aurora anything…"}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[220px] flex-1 resize-none bg-transparent px-1.5 py-2 text-[15px] leading-relaxed text-ink-100 placeholder:text-ink-400 focus:outline-none"
          />

          <MicButton listening={listening} onToggle={() => setListening((v) => !v)} />

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-ink-950 transition-colors hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
            >
              <StopIcon className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              aria-label="Send message"
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 ${
                !draft.trim()
                  ? "bg-ink-700/50 text-ink-500"
                  : "bg-accent-500 text-ink-950 hover:bg-accent-400"
              }`}
            >
              <SendIcon className="size-[18px]" />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-ink-400">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>NVIDIA NIM · Neon Postgres</span>
        </div>
      </div>
    </div>
  );
}

function MicButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={listening ? "Stop listening" : "Start voice input"}
      aria-pressed={listening}
      title={listening ? "Stop listening" : "Voice input — Phase 4 wires up recognition"}
      className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 ${
        listening ? "bg-accent-500 text-ink-950" : "text-ink-300 hover:bg-ink-700 hover:text-ink-100"
      }`}
    >
      {listening && (
        <>
          <span className="mic-ring absolute inset-0 rounded-xl bg-accent-500/40" aria-hidden="true" />
          <span
            className="mic-ring absolute inset-0 rounded-xl bg-accent-500/30"
            style={{ animationDelay: "0.6s" }}
            aria-hidden="true"
          />
        </>
      )}
      {listening ? (
        <span className="relative flex h-4 items-end gap-[2.5px]" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="eq-bar h-3.5 w-[3px] rounded-full bg-ink-950"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
        </span>
      ) : (
        <MicIcon className="relative size-[18px]" />
      )}
    </button>
  );
}
