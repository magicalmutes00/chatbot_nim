import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatHeader from "./components/ChatHeader";
import MessageList from "./components/MessageList";
import EmptyState from "./components/EmptyState";
import Composer from "./components/Composer";
import AuthGate from "./components/AuthGate";
import { SparkIcon } from "./components/Icons";
import { authClient, useSession } from "./lib/auth";
import {
  fetchConversationMessages,
  fetchHealth,
  listConversations,
  removeConversation,
  streamChat,
} from "./lib/api";
import type { ConversationSummary } from "./lib/api";
import { MODELS } from "./lib/mock";
import type { ChatMessage } from "./lib/types";

let idCounter = 0;
const nextId = () => `m${++idCounter}-${Date.now()}`;

const HISTORY_LIMIT = 20;

export default function App() {
  const { data: sessionData, isPending: sessionLoading } = useSession();
  const authUser = sessionData?.user ?? null;

  const [health, setHealth] = useState<{ database: boolean } | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(MODELS[0]);
  const [streaming, setStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const connected = health?.database === true;

  const refreshConversations = useCallback(() => {
    if (!connected) return;
    listConversations()
      .then(setConversations)
      .catch(() => undefined);
  }, [connected]);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (authUser && connected) refreshConversations();
  }, [authUser, connected, refreshConversations]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = (text: string, source: "typed" | "voice" = "typed") => {
    if (streaming) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text };
    const assistantId = nextId();

    // Trimmed, clean history: drop failed/empty assistant turns.
    const history = messages
      .filter((m) => !(m.role === "assistant" && (m.error || m.content.trim().length === 0)))
      .slice(-HISTORY_LIMIT);

    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setDraft("");
    setStreaming(true);
    setStreamingId(assistantId);

    const controller = new AbortController();
    abortRef.current = controller;

    streamChat(
      {
        messages: [...history, userMsg],
        model: model.id,
        conversationId: activeId,
        source,
        signal: controller.signal,
      },
      {
        onStart: (conversationId) => setActiveId(conversationId),
        onDelta: (t) =>
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + t } : msg)),
          ),
        onDone: () => {
          setStreaming(false);
          setStreamingId(null);
          refreshConversations();
        },
        onError: (message) => {
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, error: message } : msg)),
          );
          setStreaming(false);
          setStreamingId(null);
          refreshConversations();
        },
      },
    ).catch((err: unknown) => {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (!aborted) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, error: err instanceof Error ? err.message : "Network error — is the server running?" }
              : msg,
          ),
        );
      }
      setStreaming(false);
      setStreamingId(null);
    });
  };

  const selectConversation = useCallback(
    async (id: string) => {
      if (streaming) abortRef.current?.abort();
      setActiveId(id);
      try {
        const stored = await fetchConversationMessages(id);
        setMessages(
          stored.map((m) => ({
            id: m.id,
            role: m.role === "USER" ? "user" : "assistant",
            content: m.content,
          })),
        );
        setDraft("");
      } catch (err) {
        setMessages([
          {
            id: nextId(),
            role: "assistant",
            content: "",
            error: err instanceof Error ? err.message : "Could not load the conversation.",
          },
        ]);
      }
    },
    [streaming],
  );

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setActiveId(null);
    setDraft("");
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await removeConversation(id);
      } catch {
        return;
      }
      setConversations((cs) => cs.filter((c) => c.id !== id));
      if (id === activeId) {
        setMessages([]);
        setActiveId(null);
      }
    },
    [activeId],
  );

  const signOut = useCallback(async () => {
    abortRef.current?.abort();
    await authClient.signOut();
    setConversations([]);
    setMessages([]);
    setActiveId(null);
    setDraft("");
  }, []);

  // ── Auth gates ─────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <SparkIcon className="size-8 animate-pulse" />
      </div>
    );
  }

  if (!authUser) {
    return <AuthGate />;
  }

  return (
    <div className="flex h-full">
      <Sidebar
        mode={connected ? "connected" : "local"}
        user={{
          name: authUser.name ?? authUser.email.split("@")[0],
          email: authUser.email,
        }}
        conversations={conversations}
        activeId={activeId}
        onNewChat={newChat}
        onSelectConversation={(id) => void selectConversation(id)}
        onDeleteConversation={(id) => void deleteConversation(id)}
        onSignOut={() => void signOut()}
      />
      <main className="flex h-full min-w-0 flex-1 flex-col">
        <ChatHeader model={model} onModelChange={setModel} connected={connected} />
        {messages.length === 0 ? (
          <EmptyState name={authUser.name?.split(" ")[0] ?? "there"} onSuggestion={setDraft} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MessageList messages={messages} streamingId={streamingId} />
          </div>
        )}
        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSend={send}
          onStop={stop}
          streaming={streaming}
        />
      </main>
    </div>
  );
}
