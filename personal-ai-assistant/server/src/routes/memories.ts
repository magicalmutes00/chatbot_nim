import type { FastifyInstance } from "fastify";
import { isDbConfigured } from "../config/env.js";
import { requireAuth } from "../auth/plugin.js";
import { NimError } from "../ai/nim.js";
import {
  MAX_MEMORY_CHARS,
  addMemory,
  deleteMemory,
  getMemorySettings,
  listMemories,
  setAutoRemember,
} from "../memory/store.js";

export async function memoryRoutes(app: FastifyInstance) {
  app.get("/api/memories", { preHandler: isDbConfigured ? [requireAuth] : [] }, async (request, reply) => {
    if (!isDbConfigured || !request.user) {
      return reply.code(503).send({ error: "Database not configured." });
    }
    const [memories, settings] = await Promise.all([
      listMemories(request.user.id),
      getMemorySettings(request.user.id),
    ]);
    return { memories, ...settings };
  });

  app.post(
    "/api/memories",
    {
      preHandler: isDbConfigured ? [requireAuth] : [],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (request) => request.user?.id ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      if (!isDbConfigured || !request.user) {
        return reply.code(503).send({ error: "Database not configured." });
      }
      const body = (request.body ?? {}) as { content?: unknown };
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (content.length === 0 || content.length > MAX_MEMORY_CHARS) {
        return reply
          .code(400)
          .send({ error: `content must be between 1 and ${MAX_MEMORY_CHARS} characters.` });
      }

      try {
        const result = await addMemory(request.user.id, content, "MANUAL");
        return result;
      } catch (err) {
        if (err instanceof NimError) {
          const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
          return reply.code(status).send({ error: err.message });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Could not save that memory." });
      }
    },
  );

  app.patch(
    "/api/memories/settings",
    { preHandler: isDbConfigured ? [requireAuth] : [] },
    async (request, reply) => {
      if (!isDbConfigured || !request.user) {
        return reply.code(503).send({ error: "Database not configured." });
      }
      const body = (request.body ?? {}) as { autoRemember?: unknown };
      if (typeof body.autoRemember !== "boolean") {
        return reply.code(400).send({ error: "autoRemember must be a boolean." });
      }
      await setAutoRemember(request.user.id, body.autoRemember);
      return { autoRemember: body.autoRemember };
    },
  );

  app.delete(
    "/api/memories/:id",
    { preHandler: isDbConfigured ? [requireAuth] : [] },
    async (request, reply) => {
      if (!isDbConfigured || !request.user) {
        return reply.code(503).send({ error: "Database not configured." });
      }
      const { id } = request.params as { id: string };
      const removed = await deleteMemory(request.user.id, id);
      if (!removed) return reply.code(404).send({ error: "Memory not found." });
      return { ok: true };
    },
  );
}
