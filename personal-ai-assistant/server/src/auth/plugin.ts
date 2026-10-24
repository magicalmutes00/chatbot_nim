import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export const SESSION_COOKIE = "better-auth.session_token";
const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

interface AuthRow {
  userId: string;
  email: string;
  name: string | null;
}

/**
 * Validates a Neon Auth (Managed Better Auth) session.
 *
 * The auth tables live in our own Postgres (schema `neon_auth`), so the
 * session cookie's token is verified with a single local SQL lookup —
 * no round-trip to the auth server.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawCandidates = [request.cookies[SESSION_COOKIE], request.cookies[SECURE_SESSION_COOKIE]].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  // Better Auth signs cookie values ("<token>.<signature>") — try the bare token too.
  const candidates = new Set<string>();
  for (const raw of rawCandidates) {
    candidates.add(raw);
    const dot = raw.indexOf(".");
    if (dot > 0) candidates.add(raw.slice(0, dot));
  }

  if (candidates.size === 0) {
    void reply.code(401).send({ error: "Not signed in." });
    return;
  }

  const tokenList = Prisma.join([...candidates].map((c) => Prisma.sql`${c}`));
  const rows = await prisma.$queryRaw<AuthRow[]>(Prisma.sql`
    SELECT s."userId" AS "userId", u.email AS email, u.name AS name
    FROM neon_auth.session s
    JOIN neon_auth."user" u ON u."id" = s."userId"
    WHERE s."token" IN (${tokenList}) AND s."expiresAt" > now()
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) {
    void reply.code(401).send({ error: "Session expired — sign in again." });
    return;
  }

  // Mirror the auth user into public.users (our settings/preferences home).
  const user = await prisma.user.upsert({
    where: { id: row.userId },
    update: { email: row.email, name: row.name },
    create: { id: row.userId, email: row.email, name: row.name },
  });

  request.user = { id: user.id, email: user.email, name: user.name };
}
