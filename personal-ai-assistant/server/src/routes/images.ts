import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { isDbConfigured, isS3Configured } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../auth/plugin.js";
import { NimError } from "../ai/nim.js";
import { IMAGE_MODELS, IMAGE_SIZES, generateImage, imageModelMeta, type ImageSize } from "../ai/imagegen.js";
import { presignAttachmentGet, putAttachment } from "./attachments.js";

const MAX_PROMPT_CHARS = 1_200;

function titleFrom(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return "New image";
  return clean.length <= 60 ? clean : `${clean.slice(0, 57).trimEnd()}…`;
}

export async function imageRoutes(app: FastifyInstance) {
  app.get("/api/images/models", async () => ({ models: IMAGE_MODELS, sizes: Object.keys(IMAGE_SIZES) }));

  app.post(
    "/api/images/generate",
    {
      preHandler: [requireAuth],
      // Image synthesis is the most expensive call in the app.
      config: {
        rateLimit: {
          max: 6,
          timeWindow: "1 minute",
          keyGenerator: (request) => request.user?.id ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      if (!isDbConfigured) {
        return reply.code(503).send({ error: "Database not configured." });
      }
      if (!isS3Configured) {
        return reply.code(503).send({ error: "Image storage is not configured on the server." });
      }

      const user = request.user!;
      const body = (request.body ?? {}) as {
        prompt?: unknown;
        model?: unknown;
        size?: unknown;
        conversationId?: unknown;
      };

      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (prompt.length === 0 || prompt.length > MAX_PROMPT_CHARS) {
        return reply.code(400).send({ error: `prompt must be between 1 and ${MAX_PROMPT_CHARS} characters.` });
      }

      const model = typeof body.model === "string" ? body.model : IMAGE_MODELS[0].id;
      const meta = imageModelMeta(model);
      if (!meta) {
        return reply.code(400).send({
          error: `Unknown image model. Choose one of: ${IMAGE_MODELS.map((m) => m.id).join(", ")}`,
        });
      }

      const size = (typeof body.size === "string" && body.size in IMAGE_SIZES ? body.size : "1:1") as ImageSize;

      // ── Conversation bookkeeping ──
      let conversationId: string;
      try {
        if (typeof body.conversationId === "string" && body.conversationId.length > 0) {
          const existing = await prisma.conversation.findFirst({
            where: { id: body.conversationId, userId: user.id },
            select: { id: true },
          });
          if (!existing) return reply.code(404).send({ error: "Conversation not found." });
          conversationId = existing.id;
        } else {
          const created = await prisma.conversation.create({
            data: { userId: user.id, title: titleFrom(prompt) },
            select: { id: true },
          });
          conversationId = created.id;
        }
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: "Database error while preparing the image." });
      }

      // Abort the upstream render if the client disconnects.
      const abort = new AbortController();
      request.raw.on("close", () => abort.abort());

      let generated: Awaited<ReturnType<typeof generateImage>>;
      try {
        generated = await generateImage({
          model: meta.id,
          prompt,
          size,
          signal: abort.signal,
        });
      } catch (err) {
        if (err instanceof NimError) {
          const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
          return reply.code(status).send({ error: err.message });
        }
        request.log.error(err);
        return reply.code(502).send({ error: "Image generation failed. Try again in a moment." });
      }

      const key = `${user.id}/generated-${crypto.randomUUID()}.${generated.extension}`;
      const filename = `aurora-${Date.now()}.${generated.extension}`;

      try {
        await putAttachment(key, generated.buffer, generated.mimeType);
      } catch (err) {
        request.log.error(err);
        return reply.code(502).send({ error: "Generated the image but could not store it." });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          await tx.message.create({
            data: { conversationId, userId: user.id, role: "USER", content: prompt, model: meta.id },
          });
          const assistant = await tx.message.create({
            data: {
              conversationId,
              userId: user.id,
              role: "ASSISTANT",
              content: "",
              model: meta.id,
            },
          });
          await tx.attachment.create({
            data: {
              userId: user.id,
              messageId: assistant.id,
              filename,
              mimeType: generated.mimeType,
              sizeBytes: generated.buffer.length,
              storageKey: key,
            },
          });
          await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
          return assistant.id;
        });

        const url = await presignAttachmentGet(key);
        return {
          conversationId,
          messageId: result,
          image: {
            key,
            url,
            filename,
            mimeType: generated.mimeType,
            sizeBytes: generated.buffer.length,
          },
          model: meta.id,
          seed: generated.seed,
        };
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: "Generated the image but could not save the conversation." });
      }
    },
  );
}
