import { useEffect, useRef } from "react";
import type { ChatMessage, MessageImage } from "../lib/types";
import Markdown from "./Markdown";
import { BrainIcon, ChecklistIcon, SparkIcon } from "./Icons";

type MessageListProps = {
  messages: ChatMessage[];
  streamingId: string | null;
};

export default function MessageList({ messages, streamingId }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streamingId]);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      {messages.map((m) => (
        <MessageRow key={m.id} message={m} streaming={m.id === streamingId} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageRow({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  if (message.role === "user") {
    return (
      <div className="animate-fade-up flex flex-col items-end gap-2">
        {message.images && message.images.length > 0 && (
          <div className="max-w-[min(440px,75%)]">
            <MessageImages images={message.images} />
          </div>
        )}
        {message.content && (
          <div className="max-w-[75%] rounded-2xl rounded-br-md bg-ink-700/80 px-4 py-3 text-[15px] leading-relaxed text-ink-100">
            {message.content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-up flex gap-3.5">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink-800 ring-1 ring-ink-700">
        <SparkIcon className="size-4" />
      </div>
      <div className="min-w-0 max-w-[75ch] pt-0.5">
        {message.content ? (
          <Markdown>{message.content + (streaming ? " ▍" : "")}</Markdown>
        ) : streaming ? (
          <p className="flex items-center gap-2 pt-1 text-[15px] text-ink-300">
            <span className="size-1.5 animate-pulse rounded-full bg-accent-400" aria-hidden="true" />
            Generating…
          </p>
        ) : null}
        {message.images && message.images.length > 0 && (
          <div className={message.content ? "mt-3" : ""}>
            <MessageImages images={message.images} />
          </div>
        )}
        {!streaming && message.memoriesUsed !== undefined && message.memoriesUsed > 0 && (
          <p
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink-850 px-2.5 py-1 text-[11px] text-ink-400 ring-1 ring-ink-700"
            title="Long-term memories folded into this reply"
          >
            <BrainIcon className="size-3 text-accent-400" />
            Used {message.memoriesUsed} {message.memoriesUsed === 1 ? "memory" : "memories"}
          </p>
        )}
        {!streaming && message.tasksCreated && message.tasksCreated.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {message.tasksCreated.map((task) => (
              <span
                key={task.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-ink-850 px-2.5 py-1 text-[11px] text-ink-300 ring-1 ring-ink-700"
                title="Added to your Tasks panel"
              >
                <ChecklistIcon className="size-3 shrink-0 text-accent-400" />
                <span className="truncate">{task.title}</span>
                {task.dueAt && (
                  <span className="shrink-0 text-ink-500">
                    ·{" "}
                    {new Date(task.dueAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
        {message.error && <ErrorCard message={message.error} />}
      </div>
    </div>
  );
}

function MessageImages({ images }: { images: MessageImage[] }) {
  return (
    <div className={`grid gap-2 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {images.map((image) => (
        <a
          key={image.key ?? image.url}
          href={image.url}
          target="_blank"
          rel="noreferrer"
          title={`Open ${image.filename}`}
          className="group relative overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-700 transition-shadow hover:ring-ink-500"
        >
          <img
            src={image.url}
            alt={image.filename}
            loading="lazy"
            className="max-h-[460px] w-full object-contain"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[11px] text-ink-100 opacity-0 transition-opacity group-hover:opacity-100">
            Open image
          </span>
        </a>
      ))}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-xl bg-amber-400/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-200 ring-1 ring-amber-400/30">
      {message}
    </div>
  );
}
