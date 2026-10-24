import type { FastifyInstance } from "fastify";
import { isDbConfigured, isNeonAuthConfigured } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { nim } from "../ai/nim.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => {
    let database = false;
    if (isDbConfigured) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        database = true;
      } catch {
        database = false;
      }
    }

    return {
      ok: true,
      service: "aurora-server",
      version: "0.1.0",
      database,
      nim: { configured: nim.configured, baseUrl: nim.baseUrl },
      auth: { mode: isNeonAuthConfigured ? "neon-auth" : "none" },
      time: new Date().toISOString(),
    };
  });
}
