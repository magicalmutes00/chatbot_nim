import { useEffect, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "../lib/firebase";
import {
  authErrorMessage,
  completeGoogleRedirect,
  signInWithGoogle,
} from "../lib/auth";
import { SparkIcon } from "./Icons";

type AuthViewName = "sign-in" | "sign-up";

/**
 * Sign-in / sign-up screen.
 *
 * Firebase owns credentials and sessions; the Aurora server only ever sees a
 * short-lived ID token. Google uses a popup (the desktop webview is built with
 * popups enabled); a blocked popup falls back to a redirect.
 */
export default function AuthGate() {
  const [view, setView] = useState<AuthViewName>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Finish a Google redirect sign-in (a browser that blocked the popup). No-op
  // when the page was not a redirect return.
  useEffect(() => {
    let mounted = true;
    completeGoogleRedirect()
      .then((warning) => {
        if (mounted && warning) setError(warning);
      })
      .catch((err: unknown) => {
        if (mounted) setError(authErrorMessage(err));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const switchView = (next: AuthViewName) => {
    setView(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firebaseAuth || busy) return;
    setBusy("form");
    setError(null);
    setNotice(null);
    try {
      if (view === "sign-in") {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      }
      // `onAuthStateChanged` in useSession swaps the gate out for the app.
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    if (!firebaseAuth || busy) return;
    setBusy("google");
    setError(null);
    setNotice(null);
    try {
      await signInWithGoogle();
      // If we are still here the popup flow succeeded and `onAuthStateChanged`
      // swaps the gate out for the app; a blocked popup navigates instead.
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    if (!firebaseAuth || busy) return;
    const address = email.trim();
    if (address.length === 0) {
      setError("Enter your email first, then tap “Forgot password”.");
      setNotice(null);
      return;
    }
    setBusy("form");
    setError(null);
    setNotice(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, address);
      setNotice(`Password reset link sent to ${address}.`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

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

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-ink-900 p-1">
          {(["sign-in", "sign-up"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => switchView(v)}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                view === v ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-200"
              }`}
            >
              {v === "sign-in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-700">
          {!isFirebaseConfigured ? (
            <p className="rounded-xl bg-amber-400/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-200 ring-1 ring-amber-400/25">
              Firebase is not configured. Add the <code>VITE_FIREBASE_*</code> keys to{" "}
              <code>apps/web/.env</code> and restart the dev server.
            </p>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-300">Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={disabled}
                    className="w-full rounded-xl bg-ink-900 px-3.5 py-2.5 text-sm text-ink-100 ring-1 ring-ink-700 outline-none transition-colors placeholder:text-ink-500 focus:ring-ink-500 disabled:opacity-60"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-300">Password</span>
                  <input
                    type="password"
                    required
                    autoComplete={view === "sign-in" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={view === "sign-in" ? "Your password" : "At least 6 characters"}
                    disabled={disabled}
                    className="w-full rounded-xl bg-ink-900 px-3.5 py-2.5 text-sm text-ink-100 ring-1 ring-ink-700 outline-none transition-colors placeholder:text-ink-500 focus:ring-ink-500 disabled:opacity-60"
                  />
                </label>

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-500/10 px-3 py-2 text-[12px] leading-snug text-red-300 ring-1 ring-red-500/30"
                  >
                    {error}
                  </p>
                )}
                {notice && (
                  <p
                    role="status"
                    className="rounded-xl bg-accent-500/10 px-3 py-2 text-[12px] leading-snug text-accent-200 ring-1 ring-accent-500/30"
                  >
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={disabled}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "form" && <Spinner />}
                  {view === "sign-in" ? "Sign in" : "Create account"}
                </button>
              </form>

              {view === "sign-in" && (
                <button
                  type="button"
                  onClick={() => void handleReset()}
                  disabled={disabled}
                  className="mt-2 w-full text-center text-[11px] text-ink-400 transition-colors hover:text-ink-200 disabled:opacity-60"
                >
                  Forgot password?
                </button>
              )}

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-ink-700" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-500">or</span>
                <span className="h-px flex-1 bg-ink-700" />
              </div>

              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={disabled}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-ink-900 py-2.5 text-sm font-medium text-ink-100 ring-1 ring-ink-700 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "google" ? <Spinner /> : <GoogleIcon />}
                Continue with Google
              </button>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-400">
          Secured by Firebase Auth — conversations and memories stay in your own Neon database.
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
