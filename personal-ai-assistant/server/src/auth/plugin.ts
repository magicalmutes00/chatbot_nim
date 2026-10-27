import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db/prisma.js";
import { verifyFirebaseIdToken } from "./firebase.js";

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

/**
 * Validates the Firebase ID token sent in `Authorization: Bearer <token>`.
 *
 * The client refreshes the token itself (the Firebase SDK caches it), so the
 * server only has to verify the signature and mirror the account into
 * `public.users`. Rows are matched by email so accounts created during the
 * Neon Auth era keep their conversations, memories, and tasks.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (token.length === 0) {
    void reply.code(401).send({ error: "Not signed in." });
    return;
  }

  const identity = await verifyFirebaseIdToken(token);
  if (!identity) {
    void reply.code(401).send({ error: "Session expired — sign in again." });
    return;
  }

  const user = await prisma.user.upsert({
    where: { email: identity.email },
    update: { name: identity.name ?? undefined },
    create: { id: identity.uid, email: identity.email, name: identity.name },
  });

  request.user = { id: user.id, email: user.email, name: user.name };
}
