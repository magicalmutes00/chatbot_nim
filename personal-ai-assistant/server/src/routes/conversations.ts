import type { FastifyInstance } from "fastify";
import { isDbConfigured, isS3Configured } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../auth/plugin.js";
import { presignAttachmentGet } from "./attachments.js";

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
      select: {
        id: true,
        role: true,
        content: true,
        source: true,
        model: true,
        createdAt: true,
        attachments: {
          select: { storageKey: true, filename: true, mimeType: true, sizeBytes: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Presign stored images (uploads and generated art) so the client can render them.
    const hydrated = await Promise.all(
      messages.map(async ({ attachments, ...message }) => {
        const images = await Promise.all(
          attachments.map(async (a) => {
            if (!isS3Configured) return null;
            try {
              return {
                key: a.storageKey,
                url: await presignAttachmentGet(a.storageKey),
                filename: a.filename,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
              };
            } catch {
              return null;
            }
          }),
        );
        return { ...message, attachments: images.filter((image) => image !== null) };
      }),
    );

    return { messages: hydrated };
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
