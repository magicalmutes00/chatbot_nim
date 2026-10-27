import { SUGGESTIONS } from "../lib/mock";
import type { SuggestionIcon } from "../lib/mock";
import { PaperclipIcon, PlusIcon, SearchIcon, SparkIcon } from "./Icons";

const ICONS: Record<SuggestionIcon, typeof SparkIcon> = {
  spark: SparkIcon,
  search: SearchIcon,
  task: PlusIcon,
  write: PaperclipIcon,
};

function greeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 5) return `Up late, ${name}`;
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

export default function EmptyState({ name, onSuggestion }: { name: string; onSuggestion: (prompt: string) => void }) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-10">
      {/* Aurora glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500/10 blur-[120px]" />
        <div className="absolute left-1/4 top-1/2 size-64 -translate-y-1/2 rounded-full bg-accent-700/15 blur-[100px]" />
        <div className="absolute right-1/4 top-1/2 size-64 -translate-y-1/2 rounded-full bg-ink-500/15 blur-[100px]" />
      </div>

      <div className="relative flex w-full max-w-[720px] flex-col items-center text-center">
        <div className="animate-fade-up flex size-12 items-center justify-center rounded-2xl bg-ink-850 ring-1 ring-ink-700">
          <SparkIcon className="size-6" />
        </div>
        <h1 className="animate-fade-up mt-6 font-display text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-ink-100">
          {greeting(name)}
        </h1>
        <p className="animate-fade-up mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink-300">
          Your personal AI assistant. Ask anything by text — or tap the mic and say it out loud.
        </p>

        <div className="animate-fade-up mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map((s, i) => {
            const Icon = ICONS[s.icon];
            const isLarge = i === 0;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => onSuggestion(s.prompt)}
                className={`group flex items-center gap-3 rounded-2xl bg-ink-850/70 px-4 py-4 text-left text-[14px] leading-snug text-ink-200 ring-1 ring-ink-700 transition-all hover:bg-ink-800 hover:text-ink-50 hover:ring-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                  isLarge ? "sm:col-span-2" : ""
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 ring-1 ring-ink-700 group-hover:bg-ink-700">
                  <Icon className="size-[18px] text-accent-400" />
                </span>
                <div className="min-w-0">
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-[12px] text-ink-400">Quick start • {s.label.toLowerCase()}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
