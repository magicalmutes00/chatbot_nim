import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { env, isDbConfigured, isNeonAuthConfigured, isNimConfigured } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { chatRoutes } from "./routes/chat.js";
import { conversationRoutes } from "./routes/conversations.js";
import { neonAuthProxy } from "./auth/proxy.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.webOrigin.split(","), credentials: true });
await app.register(cookie);
await app.register(healthRoutes);
await app.register(chatRoutes);
await app.register(conversationRoutes);

// Neon Auth (Managed Better Auth) — proxy auth API calls so session cookies
// stay first-party on the app's origin.
if (isNeonAuthConfigured) {
  await app.register(neonAuthProxy);
  app.log.info(`Neon Auth proxy → ${env.neonAuthBaseUrl}`);
} else {
  app.log.warn("NEON_AUTH_BASE_URL not set — auth proxy disabled");
}

const start = async () => {
  try {
    await app.listen({ port: env.port, host: "0.0.0.0" });
    app.log.info(
      isDbConfigured ? "Neon database connected" : "NEON_DATABASE_URL not set — UI shell mode",
    );
    app.log.info(
      isNimConfigured ? "NVIDIA NIM API key loaded" : "NVIDIA_NIM_API_KEY not set — chat disabled",
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
