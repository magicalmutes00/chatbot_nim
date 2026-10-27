import "dotenv/config";
import type { FastifyError } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  env,
  isDbConfigured,
  isFirebaseAuthConfigured,
  isNimConfigured,
  isS3Configured,
} from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { chatRoutes } from "./routes/chat.js";
import { conversationRoutes } from "./routes/conversations.js";
import { attachmentRoutes } from "./routes/attachments.js";
import { imageRoutes } from "./routes/images.js";
import { memoryRoutes } from "./routes/memories.js";
import { taskRoutes } from "./routes/tasks.js";
import { prisma } from "./db/prisma.js";

const app = Fastify({
  logger: true,
  bodyLimit: 2 * 1024 * 1024,
  requestTimeout: 120_000,
});

await app.register(cors, { origin: env.webOrigin.split(",").map((o) => o.trim()), credentials: true });

// Broad protection for every route; the expensive AI route tightens this further.
await app.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: "1 minute",
  allowList: [],
});

await app.register(healthRoutes);
await app.register(chatRoutes);
await app.register(conversationRoutes);
await app.register(attachmentRoutes);
await app.register(imageRoutes);
await app.register(memoryRoutes);
await app.register(taskRoutes);

if (isFirebaseAuthConfigured) {
  app.log.info(`Firebase Auth enabled — project ${env.firebaseProjectId}`);
} else {
  app.log.warn("FIREBASE_PROJECT_ID not set - authenticated routes will reject requests");
}

// Baseline security headers (skipped for SSE streams, which set their own).
app.addHook("onSend", async (_request, reply) => {
  const contentType = String(reply.getHeader("content-type") ?? "");
  if (contentType.includes("text/event-stream")) return;
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("X-Frame-Options", "DENY");
});

app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ error: `Route ${request.method} ${request.url} not found` });
});

app.setErrorHandler((err: FastifyError, request, reply) => {
  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  if (status >= 500) request.log.error(err);
  const message = status >= 500 ? "Internal server error" : err.message;
  reply.code(status).send({ error: message });
});

const missing: string[] = [];
if (!isDbConfigured) missing.push("NEON_DATABASE_URL");
if (!isNimConfigured) missing.push("NVIDIA_NIM_API_KEY");
if (!isFirebaseAuthConfigured) missing.push("FIREBASE_PROJECT_ID");
if (!isS3Configured) missing.push("S3_ENDPOINT / S3_BUCKET");

const start = async () => {
  try {
    await app.listen({ port: env.port, host: "0.0.0.0" });
    app.log.info(`Server listening on ${env.port} (web origin: ${env.webOrigin})`);
    app.log.info(
      `Features: db=${isDbConfigured} nim=${isNimConfigured} auth=${isFirebaseAuthConfigured} s3=${isS3Configured}`,
    );
    if (missing.length > 0) app.log.warn(`Missing env vars: ${missing.join(", ")}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received - shutting down`);
  try {
    await app.close();
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start();
