import { useState } from "react";
import { AuthView } from "@neondatabase/auth-ui";
import { SparkIcon } from "./Icons";

type AuthViewName = "sign-in" | "sign-up";

export default function AuthGate() {
  const [view, setView] = useState<AuthViewName>("sign-in");

  return (
    <div className="relative flex h-full items-center justify-center overflow-y-auto px-6 py-10">
      {/* Aurora glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500/10 blur-[120px]" />
        <div className="absolute left-1/4 top-1/2 size-64 -translate-y-1/2 rounded-full bg-accent-700/15 blur-[100px]" />
        <div className="absolute right-1/4 top-1/2 size-64 -translate-y-1/2 rounded-full bg-ink-500/15 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-ink-850 ring-1 ring-ink-700">
            <SparkIcon className="size-6" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink-100">
            Welcome to Aurora
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
            Your personal AI assistant — powered by NVIDIA NIM, backed by Neon.
          </p>
        </div>

        <div className="auth-tabs mt-6 grid grid-cols-2 gap-1 rounded-xl bg-ink-900 p-1">
          {(["sign-in", "sign-up"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                view === v ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-200"
              }`}
            >
              {v === "sign-in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-ink-850 ring-1 ring-ink-700">
          <AuthView pathname={view} />
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-400">
          Secured by Neon Auth — accounts and sessions live in your own Neon database.
        </p>
      </div>
    </div>
  );
}
