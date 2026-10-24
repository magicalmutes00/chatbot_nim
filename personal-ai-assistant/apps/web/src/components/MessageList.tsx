import { useEffect, useRef } from "react";
import type { ChatMessage } from "../lib/types";
import Markdown from "./Markdown";
import { SparkIcon } from "./Icons";

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
      <div className="animate-fade-up flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-ink-700/80 px-4 py-3 text-[15px] leading-relaxed text-ink-100">
          {message.content}
        </div>
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
          <p className="pt-1 text-[15px] text-ink-300">▍</p>
        ) : null}
        {message.error && <ErrorCard message={message.error} />}
      </div>
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
