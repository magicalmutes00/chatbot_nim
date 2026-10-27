import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatHeader from "./components/ChatHeader";
import MessageList from "./components/MessageList";
import EmptyState from "./components/EmptyState";
import Composer from "./components/Composer";
import AuthGate from "./components/AuthGate";
import MemoryPanel from "./components/MemoryPanel";
import TasksPanel from "./components/TasksPanel";
import { SparkIcon } from "./components/Icons";
import { signOutUser, useSession } from "./lib/auth";
import {
  countOpenTasks,
  fetchConversationMessages,
  fetchHealth,
  generateImage,
  listConversations,
  removeConversation,
  streamChat,
} from "./lib/api";
import type { ConversationSummary } from "./lib/api";
import { MODELS } from "./lib/mock";
import type { ImageSizeOption } from "./lib/mock";
import type { Attachment, ChatMessage, ModelOption } from "./lib/types";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [imageSize, setImageSize] = useState<ImageSizeOption>("1:1");
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  useEffect(() => {
    if (!authUser || !connected) {
      setTaskCount(0);
      return;
    }
    let cancelled = false;
    countOpenTasks()
      .then((open) => {
        if (!cancelled) setTaskCount(open);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authUser, connected]);

  // Speech synthesis for assistant replies
  useEffect(() => {
    if (!speechEnabled || streaming) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.content.trim()) return;
    if (last.voicePlayed) return;
    
    const utter = new SpeechSynthesisUtterance(last.content.replace(/[*_`>#-]/g, " "));
    utter.rate = 1;
    utter.pitch = 1;
    speechRef.current = utter;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setMessages((ms) => ms.map((m, i) => i === ms.length - 1 ? { ...m, voicePlayed: true } : m));
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [messages, streaming, speechEnabled]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearAttachments = useCallback((revoke = true) => {
    setAttachments((prev) => {
      if (revoke) {
        for (const a of prev) {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        }
      }
      return [];
    });
  }, []);

  /** Attaching an image auto-switches to a vision-capable model. */
  const handleAttachmentsChange = useCallback(
    (next: Attachment[]) => {
      setAttachments(next);
      const hasImage = next.some((a) => a.mimeType.startsWith("image/"));
      if (hasImage && !model.vision) {
        const visionModel = MODELS.find((m) => m.vision);
        if (visionModel) setModel(visionModel);
      }
    },
    [model.vision],
  );

  /** Image models are text-to-image, so drop any files when switching to one. */
  const selectModel = useCallback(
    (next: ModelOption) => {
      if (next.kind === "image") clearAttachments();
      setModel(next);
    },
    [clearAttachments],
  );

  const send = (text: string, source: "typed" | "voice" = "typed") => {
    if (streaming) return;

    // Keep the pictures the user attached visible in their own message bubble.
    const sentImages = attachments
      .filter((a) => a.mimeType.startsWith("image/") && a.previewUrl)
      .map((a) => ({
        key: a.key,
        url: a.previewUrl as string,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      }));

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: text,
      ...(sentImages.length > 0 ? { images: sentImages } : {}),
    };
    const assistantId = nextId();

    // A picture needs a vision model. Auto-switch on attach covers this, but
    // re-check at send time so a manually chosen text model can't 400 the turn.
    let activeModel = model;
    if (sentImages.length > 0 && !model.vision && model.kind !== "image") {
      const visionModel = MODELS.find((m) => m.vision);
      if (visionModel) {
        activeModel = visionModel;
        setModel(visionModel);
      }
    }

    // Trimmed, clean history: drop failed/empty assistant turns.
    const history = messages
      .filter((m) => !(m.role === "assistant" && (m.error || m.content.trim().length === 0)))
      .slice(-HISTORY_LIMIT);

    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setDraft("");
    // Adopted preview URLs stay alive because the sent message still renders them.
    clearAttachments(sentImages.length === 0);
    setStreaming(true);
    setStreamingId(assistantId);

    const controller = new AbortController();
    abortRef.current = controller;

    // ── Image generation ──
    if (activeModel.kind === "image") {
      generateImage({
        prompt: text,
        model: activeModel.id,
        conversationId: activeId,
        size: imageSize,
        signal: controller.signal,
      })
        .then((res) => {
          setActiveId(res.conversationId);
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, images: [res.image] } : msg)),
          );
          refreshConversations();
        })
        .catch((err: unknown) => {
          const aborted = err instanceof DOMException && err.name === "AbortError";
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    error: aborted
                      ? "Generation stopped."
                      : err instanceof Error
                        ? err.message
                        : "Image generation failed. Try again.",
                  }
                : msg,
            ),
          );
        })
        .finally(() => {
          setStreaming(false);
          setStreamingId(null);
        });
      return;
    }

    streamChat(
      {
        messages: [...history, userMsg],
        model: activeModel.id,
        conversationId: activeId,
        source,
        signal: controller.signal,
        attachments,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        onStart: (conversationId, memoriesUsed, openTasks) => {
          setActiveId(conversationId);
          setTaskCount(openTasks);
          if (memoriesUsed > 0) {
            setMessages((m) =>
              m.map((msg) => (msg.id === assistantId ? { ...msg, memoriesUsed } : msg)),
            );
          }
        },
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
        onTasks: (tasks, open) => {
          setTaskCount(open);
          if (tasks.length === 0) return;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    tasksCreated: tasks.map((task) => ({
                      id: task.id,
                      title: task.title,
                      dueAt: task.dueAt,
                    })),
                  }
                : msg,
            ),
          );
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
          stored.map((m) => {
            const images = (m.attachments ?? [])
              .filter((a) => a.mimeType.startsWith("image/"))
              .map((a) => ({
                key: a.key,
                url: a.url,
                filename: a.filename,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
              }));
            return {
              id: m.id,
              role: m.role === "USER" ? "user" : "assistant",
              content: m.content,
              ...(images.length > 0 ? { images } : {}),
            } as ChatMessage;
          }),
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
    clearAttachments();
  }, [clearAttachments]);

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
    await signOutUser();
    setConversations([]);
    setMessages([]);
    setActiveId(null);
    setDraft("");
    clearAttachments();
    setTaskCount(0);
  }, [clearAttachments]);

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
    <div className="flex h-dvh">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-ink-950/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        mode={connected ? "connected" : "local"}
        user={{
          name: authUser.name ?? authUser.email.split("@")[0],
          email: authUser.email,
        }}
        conversations={conversations}
        activeId={activeId}
        onNewChat={() => { newChat(); setSidebarOpen(false); }}
        onSelectConversation={(id) => { void selectConversation(id); setSidebarOpen(false); }}
        onDeleteConversation={(id) => void deleteConversation(id)}
        onOpenMemory={() => {
          setSidebarOpen(false);
          setMemoryOpen(true);
        }}
        onOpenTasks={() => {
          setSidebarOpen(false);
          setTasksOpen(true);
        }}
        taskCount={taskCount}
        onSignOut={() => void signOut()}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      <TasksPanel open={tasksOpen} onClose={() => setTasksOpen(false)} onCountChange={setTaskCount} />
      <main className="flex h-dvh min-w-0 flex-1 flex-col">
        <ChatHeader model={model} onModelChange={selectModel} connected={connected} onMenu={() => setSidebarOpen(true)} speechEnabled={speechEnabled} onToggleSpeech={() => setSpeechEnabled(v => !v)} />
        {messages.length === 0 ? (
          <div className="min-h-0 flex-1">
            <EmptyState name={authUser.name?.split(" ")[0] ?? "there"} onSuggestion={setDraft} />
          </div>
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
          attachments={attachments}
          onAttachmentsChange={handleAttachmentsChange}
          imageMode={model.kind === "image"}
          imageSize={imageSize}
          onImageSizeChange={setImageSize}
          notice={
            model.id.startsWith("z-ai/glm")
              ? `${model.name} can sit in NVIDIA's queue for a few minutes before its first token. Keep this tab open — the reply will stream in when it starts.`
              : null
          }
        />
      </main>
    </div>
  );
}
