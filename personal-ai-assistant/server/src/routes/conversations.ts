import type { FastifyInstance } from "fastify";
import { isDbConfigured } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../auth/plugin.js";

export async function conversationRoutes(app: FastifyInstance) {
  app.get("/api/conversations", { preHandler: isDbConfigured ? [requireAuth] : [] }, async (request, reply) => {
    if (!isDbConfigured || !request.user) {
      return reply.code(503).send({ error: "Database not configured." });
    }
    const conversations = await prisma.conversation.findMany({
      where: { userId: request.user.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, updatedAt: true },
    });
    return { conversations };
  });

  app.get("/api/conversations/:id/messages", { preHandler: isDbConfigured ? [requireAuth] : [] }, async (request, reply) => {
    if (!isDbConfigured || !request.user) {
      return reply.code(503).send({ error: "Database not configured." });
    }
    const { id } = request.params as { id: string };
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!conversation) {
      return reply.code(404).send({ error: "Conversation not found." });
    }
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, source: true, createdAt: true },
    });
    return { messages };
  });

  app.delete("/api/conversations/:id", { preHandler: isDbConfigured ? [requireAuth] : [] }, async (request, reply) => {
    if (!isDbConfigured || !request.user) {
      return reply.code(503).send({ error: "Database not configured." });
    }
    const { id } = request.params as { id: string };
    const deleted = await prisma.conversation.deleteMany({
      where: { id, userId: request.user.id },
    });
    if (deleted.count === 0) {
      return reply.code(404).send({ error: "Conversation not found." });
    }
    return { ok: true };
  });
}
