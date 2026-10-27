import type { FastifyInstance } from "fastify";
import { isDbConfigured, isS3Configured } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../auth/plugin.js";
import { NIM_MODELS, NimError, streamChat, type ChatTurn } from "../ai/nim.js";
import { isImageModel } from "../ai/imagegen.js";
import { presignAttachmentGet } from "./attachments.js";
import { recallMemories, type RecalledMemory } from "../memory/store.js";
import { memoryContext } from "../memory/context.js";
import { rememberFromTurn } from "../memory/extract.js";
import { countOpenTasks, createTask, listOpenTasks, type TaskRecord } from "../tasks/store.js";
import { tasksContext } from "../tasks/context.js";
import { extractTasks, looksLikeTaskRequest, todayInTimezone } from "../tasks/extract.js";

interface AttachmentInput {
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

const SYSTEM_PROMPT =
  "You are Aurora, a personal AI assistant. Be warm, concise, and practical. " +
  "Format answers in Markdown when it helps readability. " +
  "If you don't know something, say so.";

const MAX_CONTENT_CHARS = 32_000;

class ConversationNotFoundError extends Error {}

function parseTurns(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw)) return null;
  const turns: ChatTurn[] = [{ role: "system", content: SYSTEM_PROMPT }];
  let sawUser = false;

  for (const item of raw) {
    const t = item as { role?: unknown; content?: unknown };
    if (typeof t?.role !== "string" || typeof t?.content !== "string") return null;
    if (t.role !== "user" && t.role !== "assistant") return null;
    if (t.content.length === 0 || t.content.length > MAX_CONTENT_CHARS) return null;
    if (t.role === "user") sawUser = true;
    turns.push({ role: t.role, content: t.content });
  }

  return sawUser ? turns : null;
}

function parseAttachments(raw: unknown, userId: string): AttachmentInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .filter(
      (a) =>
        typeof a.key === "string" &&
        typeof a.filename === "string" &&
        typeof a.mimeType === "string" &&
        typeof a.sizeBytes === "number" &&
        a.key.startsWith(`${userId}/`),
    )
    .slice(0, 6)
    .map((a) => ({
      key: a.key as string,
      filename: a.filename as string,
      mimeType: a.mimeType as string,
      sizeBytes: a.sizeBytes as number,
    }));
}

function turnText(turn: ChatTurn | undefined): string {
  if (!turn) return "";
  if (typeof turn.content === "string") return turn.content;
  const text = turn.content.find((part): part is { type: "text"; text: string } => part.type === "text");
  return text?.text ?? "";
}

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return "New chat";
  return clean.length <= 60 ? clean : `${clean.slice(0, 57).trimEnd()}…`;
}

export async function chatRoutes(app: FastifyInstance) {
  app.get("/api/models", async () => ({ models: NIM_MODELS }));

  app.post(
    "/api/chat",
    {
      preHandler: isDbConfigured ? [requireAuth] : [],
      // AI calls are expensive: cap per-user throughput on top of the global limit.
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
          keyGenerator: (request) => request.user?.id ?? request.ip,
        },
      },
    },
    async (request, reply) => {
    const body = (request.body ?? {}) as {
      conversationId?: unknown;
      model?: unknown;
      messages?: unknown;
      attachments?: unknown;
      timezone?: unknown;
    };
    const user = request.user;
    const attachments = user ? parseAttachments(body.attachments, user.id) : [];
    const model =
      typeof body.model === "string" && body.model.length > 0 && body.model.length <= 200
        ? body.model
        : "nvidia/nemotron-3.5-lightning-30b-a3b";
    const timezone =
      typeof body.timezone === "string" && body.timezone.length > 0 && body.timezone.length <= 64
        ? body.timezone
        : "UTC";
    const turns = parseTurns(body.messages);
    if (!turns) {
      return reply
        .code(400)
        .send({ error: "messages must be a non-empty array of { role: 'user' | 'assistant', content }" });
    }
    if (isImageModel(model)) {
      return reply.code(400).send({
        error: `${model} paints images. Use the image composer to send a prompt to /api/images/generate.`,
      });
    }

    // ── Long-term memory recall + open tasks ────────────────
    // Embedding, lookup, and the task list all happen before the stream starts
    // so they can shape the system prompt. Any failure degrades gracefully.
    const lastUserText = turnText([...turns].reverse().find((t) => t.role === "user"));
    const todayIso = todayInTimezone(timezone);
    const systemParts: string[] = [SYSTEM_PROMPT];

    let recalled: RecalledMemory[] = [];
    if (isDbConfigured && user && lastUserText.trim().length > 0) {
      try {
        recalled = await recallMemories(user.id, lastUserText);
      } catch (err) {
        request.log.warn({ err }, "memory recall failed");
      }
      const note = recalled.length > 0 ? memoryContext(recalled) : null;
      if (note) systemParts.push(note);
    }

    let openTaskCount = 0;
    if (isDbConfigured && user) {
      try {
        const [openTasks, count] = await Promise.all([
          listOpenTasks(user.id),
          countOpenTasks(user.id),
        ]);
        openTaskCount = count;
        const note = tasksContext(openTasks, todayIso);
        if (note) systemParts.push(note);
      } catch (err) {
        request.log.warn({ err }, "task context failed");
      }
    }

    if (systemParts.length > 1) {
      turns[0] = { role: "system", content: systemParts.join("\n\n") };
    }

    // ── Task extraction ─────────────────────────────────────
    // Cheap gate first: most messages never pay for an extra model call. The
    // call runs while the reply streams; the `tasks` event lands after `done`.
    const taskUserId = isDbConfigured ? (user?.id ?? null) : null;
    const pendingTasks: Promise<TaskRecord[]> =
      taskUserId && lastUserText.trim().length > 0 && looksLikeTaskRequest(lastUserText)
        ? extractTasks(lastUserText, todayIso)
            .then(async (drafts) => {
              const created: TaskRecord[] = [];
              for (const draft of drafts) {
                try {
                  created.push(await createTask(taskUserId, { title: draft.title, dueAt: draft.dueAt }));
                } catch (err) {
                  request.log.warn({ err }, "task create failed");
                }
              }
              return created;
            })
            .catch((err) => {
              request.log.warn({ err }, "task extraction failed");
              return [] as TaskRecord[];
            })
        : Promise.resolve([] as TaskRecord[]);

    // ── Conversation persistence (only with a connected database) ──
    let conversationId: string | null = null;
    if (isDbConfigured && user) {
      try {
        const existingId =
          typeof body.conversationId === "string" && body.conversationId.length > 0
            ? body.conversationId
            : null;

        if (existingId) {
          const conversation = await prisma.conversation.findFirst({
            where: { id: existingId, userId: user.id },
          });
          if (!conversation) throw new ConversationNotFoundError();
          conversationId = conversation.id;
        } else {
          const firstUser = [...turns].reverse().find((t) => t.role === "user");
          const conversation = await prisma.conversation.create({
            data: { userId: user.id, title: titleFrom(turnText(firstUser) || "New chat") },
          });
          conversationId = conversation.id;
        }

        // Persist the new user turn — skip if the client retried the same message.
        const lastUser = [...turns].reverse().find((t) => t.role === "user");
        let userMessageId: string | null = null;
        if (lastUser) {
          const lastPersisted = await prisma.message.findFirst({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            select: { role: true, content: true, id: true },
          });
          if (!lastPersisted || lastPersisted.role !== "USER" || lastPersisted.content !== turnText(lastUser)) {
            const created = await prisma.message.create({
              data: {
                conversationId,
                userId: user.id,
                role: "USER",
                content: turnText(lastUser),
              },
            });
            userMessageId = created.id;
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            });

            // Persist attachments if provided
            if (attachments.length > 0) {
              await prisma.attachment.createMany({
                data: attachments.map((a) => ({
                  userId: user.id,
                  messageId: userMessageId,
                  filename: a.filename,
                  mimeType: a.mimeType,
                  sizeBytes: a.sizeBytes,
                  storageKey: a.key,
                })),
              });
            }
          } else {
            userMessageId = lastPersisted.id;
          }
        }
      } catch (err) {
        if (err instanceof ConversationNotFoundError) {
          return reply.code(404).send({ error: "Conversation not found." });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Database error while saving the conversation." });
      }
    }

    // ── Image understanding ─────────────────────────────────
    const imageAttachments = attachments.filter((a) => a.mimeType.startsWith("image/"));
    if (imageAttachments.length > 0) {
      const meta = NIM_MODELS.find((m) => m.id === model);
      if (!meta?.vision) {
        return reply.code(400).send({
          error: `${meta?.label ?? model} can't read images. Switch to a vision model (Nemotron Super VL 120B or MiniMax M3.1 Flash).`,
        });
      }
      if (!isS3Configured) {
        return reply.code(503).send({ error: "Image storage is not configured on the server." });
      }

      let urls: string[];
      try {
        urls = await Promise.all(imageAttachments.map((a) => presignAttachmentGet(a.key)));
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: "Could not prepare the attached image." });
      }

      const lastUserIndex = turns.map((t) => t.role).lastIndexOf("user");
      if (lastUserIndex >= 0) {
        const text = turnText(turns[lastUserIndex]);
        const otherFiles = attachments
          .filter((a) => !a.mimeType.startsWith("image/"))
          .map((a) => `- ${a.filename} (${a.mimeType})`);
        turns[lastUserIndex] = {
          role: "user",
          content: [
            {
              type: "text",
              text: otherFiles.length ? `${text}\n\nAttached files:\n${otherFiles.join("\n")}` : text,
            },
            ...urls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ],
        };
      }
    }

    // ── Server-Sent Events response ──
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Abort the upstream request when the client disconnects (stop button).
    const abort = new AbortController();
    request.raw.on("close", () => abort.abort());

    if (conversationId) {
      send("start", { conversationId, memories: recalled.length, tasks: openTaskCount });
    }

    let full = "";
    let usage: { tokensIn: number; tokensOut: number } | null = null;

    const persistAssistant = async () => {
      if (!conversationId || !user || full.trim().length === 0) return;
      await prisma.message
        .create({
          data: {
            conversationId,
            userId: user.id,
            role: "ASSISTANT",
            content: full,
            model,
            ...(usage ? { tokensIn: usage.tokensIn, tokensOut: usage.tokensOut } : {}),
          },
        })
        .catch((err) => request.log.error(err));
    };

    try {
      for await (const delta of streamChat({
        model,
        messages: turns,
        signal: abort.signal,
        onUsage: (u) => {
          usage = u;
        },
      })) {
        full += delta;
        send("delta", { text: delta });
      }
      await persistAssistant();
      send("done", {});

      // Tasks extracted from this message are sent after the reply so the
      // first token never waits on the extra model call.
      const createdTasks = await pendingTasks;
      if (createdTasks.length > 0) {
        send("tasks", {
          tasks: createdTasks,
          open: openTaskCount + createdTasks.length,
        });
      }

      // Background: learn durable facts from this exchange. Never awaited —
      // the reply is already on the wire and extraction must not delay it.
      if (user && lastUserText.trim().length > 0 && full.trim().length > 0) {
        void rememberFromTurn(user.id, { userText: lastUserText, assistantText: full });
      }
    } catch (err) {
      if (err instanceof NimError) {
        send("error", { message: err.message });
      } else if ((err as Error)?.name === "AbortError") {
        // Client pressed stop — keep whatever streamed so far.
        await persistAssistant();
        send("done", { aborted: true });
      } else {
        request.log.error(err);
        send("error", { message: "Unexpected server error while streaming. Check the server logs." });
      }
    } finally {
      reply.raw.end();
    }
  });
}
