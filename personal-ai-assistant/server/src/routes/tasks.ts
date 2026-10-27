import type { FastifyInstance, FastifyRequest } from "fastify";
import { isDbConfigured } from "../config/env.js";
import { requireAuth } from "../auth/plugin.js";
import {
  MAX_TASK_DESCRIPTION_CHARS,
  MAX_TASK_TITLE_CHARS,
  countOpenTasks,
  createTask,
  deleteTask,
  isTaskStatus,
  listTasks,
  updateTask,
} from "../tasks/store.js";

const WRITE_RATE_LIMIT = {
  rateLimit: {
    max: 60,
    timeWindow: "1 minute",
    keyGenerator: (request: FastifyRequest) => request.user?.id ?? request.ip,
  },
};

/** `YYYY-MM-DD` is treated as noon UTC so the calendar date survives timezones. */
function parseDueInput(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  const text = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T12:00:00.000Z`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

export async function taskRoutes(app: FastifyInstance) {
  app.get("/api/tasks", { preHandler: isDbConfigured ? [requireAuth] : [] }, async (request, reply) => {
    if (!isDbConfigured || !request.user) {
      return reply.code(503).send({ error: "Database not configured." });
    }
    return { tasks: await listTasks(request.user.id) };
  });

  app.get(
    "/api/tasks/count",
    { preHandler: isDbConfigured ? [requireAuth] : [] },
    async (request, reply) => {
      if (!isDbConfigured || !request.user) {
        return reply.code(503).send({ error: "Database not configured." });
      }
      return { open: await countOpenTasks(request.user.id) };
    },
  );

  app.post(
    "/api/tasks",
    { preHandler: isDbConfigured ? [requireAuth] : [], config: WRITE_RATE_LIMIT },
    async (request, reply) => {
      if (!isDbConfigured || !request.user) {
        return reply.code(503).send({ error: "Database not configured." });
      }
      const body = (request.body ?? {}) as {
        title?: unknown;
        description?: unknown;
        dueAt?: unknown;
      };

      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (title.length === 0 || title.length > MAX_TASK_TITLE_CHARS) {
        return reply
          .code(400)
          .send({ error: `title must be between 1 and ${MAX_TASK_TITLE_CHARS} characters.` });
      }
      if (
        body.description !== undefined &&
        body.description !== null &&
        (typeof body.description !== "string" ||
          body.description.length > MAX_TASK_DESCRIPTION_CHARS)
      ) {
        return reply
          .code(400)
          .send({ error: `description must be under ${MAX_TASK_DESCRIPTION_CHARS} characters.` });
      }
      const dueAt = parseDueInput(body.dueAt);
      if (dueAt === "invalid") {
        return reply.code(400).send({ error: "dueAt must be a valid date." });
      }

      const task = await createTask(request.user.id, {
        title,
        description: typeof body.description === "string" ? body.description : null,
        dueAt,
      });
      return reply.code(201).send({ task });
    },
  );

  app.patch(
    "/api/tasks/:id",
    { preHandler: isDbConfigured ? [requireAuth] : [], config: WRITE_RATE_LIMIT },
    async (request, reply) => {
      if (!isDbConfigured || !request.user) {
        return reply.code(503).send({ error: "Database not configured." });
      }
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as {
        title?: unknown;
        description?: unknown;
        dueAt?: unknown;
        status?: unknown;
      };

      if (
        body.title === undefined &&
        body.description === undefined &&
        body.dueAt === undefined &&
        body.status === undefined
      ) {
        return reply.code(400).send({ error: "Nothing to update." });
      }
      if (body.title !== undefined) {
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (title.length === 0 || title.length > MAX_TASK_TITLE_CHARS) {
          return reply
            .code(400)
            .send({ error: `title must be between 1 and ${MAX_TASK_TITLE_CHARS} characters.` });
        }
      }
      if (
        body.description !== undefined &&
        body.description !== null &&
        (typeof body.description !== "string" ||
          body.description.length > MAX_TASK_DESCRIPTION_CHARS)
      ) {
        return reply
          .code(400)
          .send({ error: `description must be under ${MAX_TASK_DESCRIPTION_CHARS} characters.` });
      }
      const dueAt = parseDueInput(body.dueAt);
      if (dueAt === "invalid") {
        return reply.code(400).send({ error: "dueAt must be a valid date." });
      }
      if (body.status !== undefined && !isTaskStatus(body.status)) {
        return reply.code(400).send({ error: "status must be TODO, IN_PROGRESS, DONE, or CANCELLED." });
      }

      try {
        const task = await updateTask(request.user.id, id, {
          ...(body.title !== undefined ? { title: String(body.title) } : {}),
          ...(body.description !== undefined
            ? { description: typeof body.description === "string" ? body.description : null }
            : {}),
          ...(body.dueAt !== undefined ? { dueAt } : {}),
          ...(body.status !== undefined && isTaskStatus(body.status) ? { status: body.status } : {}),
        });
        if (!task) return reply.code(404).send({ error: "Task not found." });
        return { task };
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({ error: "Could not update that task." });
      }
    },
  );

  app.delete(
    "/api/tasks/:id",
    { preHandler: isDbConfigured ? [requireAuth] : [], config: WRITE_RATE_LIMIT },
    async (request, reply) => {
      if (!isDbConfigured || !request.user) {
        return reply.code(503).send({ error: "Database not configured." });
      }
      const { id } = request.params as { id: string };
      const removed = await deleteTask(request.user.id, id);
      if (!removed) return reply.code(404).send({ error: "Task not found." });
      return { ok: true };
    },
  );
}
