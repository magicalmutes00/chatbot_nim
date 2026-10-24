import type { FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import { env } from "../config/env.js";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "host",
  "content-length",
]);

/**
 * Neon Auth (Managed Better Auth) proxy.
 *
 * Forwards /api/auth/* to the managed auth service so session cookies are
 * set first-party on the app's origin. Set-Cookie Domain attributes are
 * stripped — the browser then stores the cookie for us, and requireAuth
 * validates it directly against neon_auth.session in Postgres.
 */
export async function neonAuthProxy(app: FastifyInstance) {
  if (!env.neonAuthBaseUrl) return;

  const base = env.neonAuthBaseUrl.replace(/\/+$/, "");

  await app.register(async function authProxyScope(scope) {
    // Pass request bodies through untouched (JSON stays parsed; other
    // content types arrive as raw buffers).
    scope.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => {
      done(null, body);
    });

    scope.all("/api/auth/*", async (request, reply) => {
      const wildcard = (request.params as { "*": string })["*"];
      const queryIndex = request.url.indexOf("?");
      const query = queryIndex >= 0 ? request.url.slice(queryIndex) : "";
      const url = `${base}/${wildcard}${query}`;

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        const lower = key.toLowerCase();
        if (HOP_BY_HOP.has(lower)) continue;
        headers[lower] = Array.isArray(value) ? value.join(", ") : String(value);
      }

      const method = request.method.toUpperCase();
      let body: Buffer | string | undefined;
      if (method !== "GET" && method !== "HEAD" && request.body !== undefined) {
        body = Buffer.isBuffer(request.body) ? request.body : JSON.stringify(request.body);
      }

      let upstream: Response;
      try {
        upstream = await fetch(url, { method, headers, body, redirect: "manual" });
      } catch (err) {
        scope.log.error(err, "Neon Auth proxy request failed");
        return reply.code(502).send({ error: "Auth service unreachable." });
      }

      reply.code(upstream.status);
      upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (HOP_BY_HOP.has(lower) || lower === "set-cookie") return;
        reply.header(key, value);
      });

      const setCookies = upstream.headers.getSetCookie?.() ?? [];
      if (setCookies.length > 0) {
        reply.header(
          "set-cookie",
          setCookies.map((c) => c.replace(/;\s*domain=[^;]+/gi, "")),
        );
      }

      const contentType = upstream.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const text = await upstream.text();
        return reply.send(text);
      }

      if (upstream.body) {
        return reply.send(Readable.fromWeb(upstream.body as never));
      }
      return reply.send("");
    });
  });
}
