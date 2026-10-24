import type { FastifyInstance } from "fastify";
import { isDbConfigured } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../auth/plugin.js";
import { NIM_MODELS, NimError, streamChat, type ChatTurn } from "../ai/nim.js";

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

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return "New chat";
  return clean.length <= 60 ? clean : `${clean.slice(0, 57).trimEnd()}…`;
}

export async function chatRoutes(app: FastifyInstance) {
  app.get("/api/models", async () => ({ models: NIM_MODELS }));

  app.post("/api/chat", { preHandler: isDbConfigured ? [requireAuth] : [] }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      conversationId?: unknown;
      model?: unknown;
      messages?: unknown;
    };
    const model =
      typeof body.model === "string" && body.model.length > 0 && body.model.length <= 200
        ? body.model
        : "nvidia/nemotron-3.5-lightning-30b-a3b";
    const turns = parseTurns(body.messages);
    if (!turns) {
      return reply
        .code(400)
        .send({ error: "messages must be a non-empty array of { role: 'user' | 'assistant', content }" });
    }

    // ── Conversation persistence (only with a connected database) ──
    let conversationId: string | null = null;
    if (isDbConfigured && request.user) {
      try {
        const existingId =
          typeof body.conversationId === "string" && body.conversationId.length > 0
            ? body.conversationId
            : null;

        if (existingId) {
          const conversation = await prisma.conversation.findFirst({
            where: { id: existingId, userId: request.user.id },
          });
          if (!conversation) throw new ConversationNotFoundError();
          conversationId = conversation.id;
        } else {
          const firstUser = [...turns].reverse().find((t) => t.role === "user");
          const conversation = await prisma.conversation.create({
            data: { userId: request.user.id, title: titleFrom(firstUser?.content ?? "New chat") },
          });
          conversationId = conversation.id;
        }

        // Persist the new user turn — skip if the client retried the same message.
        const lastUser = [...turns].reverse().find((t) => t.role === "user");
        if (lastUser) {
          const lastPersisted = await prisma.message.findFirst({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            select: { role: true, content: true },
          });
          if (!lastPersisted || lastPersisted.role !== "USER" || lastPersisted.content !== lastUser.content) {
            await prisma.message.create({
              data: {
                conversationId,
                userId: request.user.id,
                role: "USER",
                content: lastUser.content,
              },
            });
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            });
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
      send("start", { conversationId });
    }

    let full = "";
    let usage: { tokensIn: number; tokensOut: number } | null = null;

    const persistAssistant = async () => {
      if (!conversationId || !request.user || full.trim().length === 0) return;
      await prisma.message
        .create({
          data: {
            conversationId,
            userId: request.user.id,
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
