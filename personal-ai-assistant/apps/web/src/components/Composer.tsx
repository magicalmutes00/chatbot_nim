import { useEffect, useRef, useState } from "react";
import { MicIcon, PaperclipIcon, SendIcon, StopIcon } from "./Icons";
import { apiFetch } from "../lib/api";
import { IMAGE_SIZE_OPTIONS, type ImageSizeOption } from "../lib/mock";
import type { Attachment } from "../lib/types";

type ComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  imageMode?: boolean;
  imageSize?: ImageSizeOption;
  onImageSizeChange?: (size: ImageSizeOption) => void;
  /** Extra warning shown above the input (e.g. a model that is queueing upstream). */
  notice?: string | null;
};

export default function Composer({
  draft,
  onDraftChange,
  onSend,
  onStop,
  streaming,
  attachments,
  onAttachmentsChange,
  imageMode = false,
  imageSize = "1:1",
  onImageSizeChange,
  notice = null,
}: ComposerProps) {
  const [listening, setListening] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [draft]);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const rec = new SpeechRecognitionCtor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) {
          transcriptRef.current += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      onDraftChange((transcriptRef.current + interim).trim());
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;

    return () => {
      try { rec.stop(); } catch {}
    };
  }, [onDraftChange]);

  const toggleListening = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        transcriptRef.current = "";
        rec.start();
        setListening(true);
      } catch {}
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError([]);
    const next = [...attachments];
    const failures: string[] = [];

    try {
      for (const file of Array.from(files)) {
        try {
          const res = await apiFetch("/api/attachments/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
          });
          if (!res.ok) throw new Error(`Could not prepare “${file.name}” (${res.status})`);
          const { url, key } = (await res.json()) as { url: string; key: string };
          const put = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file,
          });
          if (!put.ok) throw new Error(`Upload failed for “${file.name}” (${put.status})`);
          next.push({
            key,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            ...(file.type.startsWith("image/") ? { previewUrl: URL.createObjectURL(file) } : {}),
          });
          onAttachmentsChange([...next]);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : `Upload failed for “${file.name}”`);
        }
      }
    } finally {
      setUploading(false);
      setUploadError(failures);
    }
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || streaming || uploading) return;
    onSend(text);
  };

  return (
    <div className="shrink-0 bg-ink-950 px-6 py-4">
      <div className="mx-auto max-w-[720px]">
        {listening && (
          <div className="mb-2.5 flex justify-center">
            <button
              type="button"
              onClick={toggleListening}
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

        {imageMode && (
          <div className="mb-2.5 flex items-center gap-1.5 px-1">
            <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-500">Aspect</span>
            {IMAGE_SIZE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onImageSizeChange?.(option.id)}
                aria-pressed={imageSize === option.id}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium ring-1 transition-colors ${
                  imageSize === option.id
                    ? "bg-accent-500/15 text-accent-200 ring-accent-500/40"
                    : "bg-ink-850 text-ink-300 ring-ink-700 hover:text-ink-100"
                }`}
              >
                {option.label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-ink-500">Paints a picture instead of replying</span>
          </div>
        )}

        {notice && (
          <div className="mb-2.5 flex items-start gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-[12px] leading-snug text-amber-200 ring-1 ring-amber-400/25">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div key={a.key} className="flex items-center gap-2 rounded-xl bg-ink-850 px-2 py-1.5 text-xs text-ink-300 ring-1 ring-ink-700">
                {a.previewUrl ? (
                  <img
                    src={a.previewUrl}
                    alt={a.filename}
                    className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-ink-700"
                  />
                ) : null}
                <span className="truncate max-w-[180px]">{a.filename}</span>
                <span className="shrink-0 text-ink-500">{formatBytes(a.sizeBytes)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${a.filename}`}
                  onClick={() => {
                    if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
                    onAttachmentsChange(attachments.filter((x) => x.key !== a.key));
                  }}
                  className="text-ink-400 hover:text-ink-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="mb-2.5 flex items-center gap-2 px-1 text-xs text-ink-400" role="status">
            <span className="size-3 animate-spin rounded-full border border-ink-500 border-t-accent-400" aria-hidden="true" />
            Uploading…
          </div>
        )}

        {uploadError.length > 0 && (
          <div className="mb-2.5 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30" role="alert">
            {uploadError.join(" · ")}
          </div>
        )}

        <div
          className={`relative flex items-end gap-1.5 rounded-2xl bg-ink-850 p-2.5 ring-1 transition-all ${
            listening
              ? "ring-accent-500/70 shadow-[0_0_0_4px_rgb(23_201_154/0.12)]"
              : "ring-ink-700 focus-within:ring-ink-500"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
          />
          {!imageMode && (
            <button
              type="button"
              aria-label="Attach files"
              title="Attach files"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 disabled:opacity-50"
            >
              <PaperclipIcon className="size-[18px]" />
            </button>
          )}

          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            placeholder={
              listening
                ? "Listening…"
                : imageMode
                  ? "Describe the image you want to create…"
                  : "Ask Aurora anything…"
            }
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[220px] flex-1 resize-none bg-transparent px-1.5 py-2 text-[15px] leading-relaxed text-ink-100 placeholder:text-ink-400 focus:outline-none"
          />

          <MicButton listening={listening} onToggle={toggleListening} />

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
              disabled={!draft.trim() || uploading}
              aria-label="Send message"
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 ${
                !draft.trim() || uploading
                  ? "bg-ink-700/50 text-ink-500"
                  : "bg-accent-500 text-ink-950 hover:bg-accent-400"
              }`}
            >
              <SendIcon className="size-[18px]" />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-ink-400">
          <span>{imageMode ? "Enter to paint · Shift+Enter for a new line" : "Enter to send · Shift+Enter for a new line"}</span>
          <span>{imageMode ? "FLUX · NVIDIA NIM" : "NVIDIA NIM · Neon Postgres"}</span>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function MicButton({ listening, onToggle }: { listening: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={listening ? "Stop listening" : "Start voice input"}
      aria-pressed={listening}
      title={listening ? "Stop listening" : "Voice input"}
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
