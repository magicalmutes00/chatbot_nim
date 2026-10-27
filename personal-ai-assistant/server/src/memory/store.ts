import { prisma } from "../db/prisma.js";
import { embedPassages, embedQuery, toVectorLiteral } from "../ai/embed.js";

/** A fact worth remembering is short; anything longer belongs in a document. */
export const MAX_MEMORY_CHARS = 400;
/** Recall only surfaces reasonably similar facts; below this the noise outweighs the value. */
const MIN_RECALL_SCORE = 0.18;
/**
 * Near-identical phrasing only. Short facts are semantically close even when
 * they say different things ("lives in Bengaluru" vs "works in Bengaluru"
 * scores 0.93), so dedupe happens mostly via the extractor seeing what is
 * already known — this is just a guard against literal repeats.
 */
const DUPLICATE_SCORE = 0.97;

export interface MemoryRecord {
  id: string;
  content: string;
  source: "MANUAL" | "AUTO";
  createdAt: Date;
}

export interface RecalledMemory extends MemoryRecord {
  score: number;
}

function normalize(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

export async function listMemories(userId: string, limit = 200): Promise<MemoryRecord[]> {
  return prisma.memory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, content: true, source: true, createdAt: true },
  });
}

export async function recallMemories(
  userId: string,
  query: string,
  limit = 5,
): Promise<RecalledMemory[]> {
  const text = normalize(query);
  if (text.length < 3) return [];

  let vector: number[];
  try {
    vector = await embedQuery(text);
  } catch {
    // Memory is an enhancement — a failing embedding call must never block a chat.
    return [];
  }

  const rows = await prisma.$queryRawUnsafe<Array<RecalledMemory>>(
    `SELECT id, content, source, "createdAt", 1 - (embedding <=> $2::halfvec) AS score
       FROM "Memory"
      WHERE "userId" = $1 AND embedding IS NOT NULL
      ORDER BY embedding <=> $2::halfvec
      LIMIT $3`,
    userId,
    toVectorLiteral(vector),
    limit,
  );

  return rows.filter((row) => Number(row.score) >= MIN_RECALL_SCORE);
}

/**
 * Stores a fact, embedding it first. A near-identical fact already in memory is
 * returned untouched so repeated conversations don't pile up duplicates.
 */
export async function addMemory(
  userId: string,
  content: string,
  source: "MANUAL" | "AUTO",
): Promise<{ memory: MemoryRecord; duplicate: boolean }> {
  const text = normalize(content).slice(0, MAX_MEMORY_CHARS);
  if (text.length === 0) throw new Error("Memory content is empty.");

  // Exact repeats are common (same sentence extracted twice) and cost nothing to catch.
  const exact = await prisma.memory.findFirst({
    where: { userId, content: text },
    select: { id: true, content: true, source: true, createdAt: true },
  });
  if (exact) return { memory: exact, duplicate: true };

  const [vector] = await embedPassages([text]);

  const nearest = await prisma.$queryRawUnsafe<Array<{ id: string; score: number }>>(
    `SELECT id, 1 - (embedding <=> $2::halfvec) AS score
       FROM "Memory"
      WHERE "userId" = $1 AND embedding IS NOT NULL
      ORDER BY embedding <=> $2::halfvec
      LIMIT 1`,
    userId,
    toVectorLiteral(vector),
  );

  if (nearest.length > 0 && Number(nearest[0].score) >= DUPLICATE_SCORE) {
    const existing = await prisma.memory.findUniqueOrThrow({
      where: { id: nearest[0].id },
      select: { id: true, content: true, source: true, createdAt: true },
    });
    return { memory: existing, duplicate: true };
  }

  const created = await prisma.memory.create({
    data: { userId, content: text, source },
    select: { id: true, content: true, source: true, createdAt: true },
  });

  // `create` can't write an Unsupported() column, so the vector lands in a second step.
  await prisma.$executeRawUnsafe(
    `UPDATE "Memory" SET embedding = $2::halfvec, "updatedAt" = now() WHERE id = $1`,
    created.id,
    toVectorLiteral(vector),
  );

  return { memory: created, duplicate: false };
}

export async function deleteMemory(userId: string, id: string): Promise<boolean> {
  const result = await prisma.memory.deleteMany({ where: { id, userId } });
  return result.count > 0;
}

/** Auto-capture is on by default; the toggle lives in `User.settings`. */
export async function getMemorySettings(userId: string): Promise<{ autoRemember: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
  const settings = (user?.settings ?? {}) as { autoRemember?: unknown };
  return { autoRemember: settings.autoRemember !== false };
}

export async function setAutoRemember(userId: string, autoRemember: boolean): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
  const settings = {
    ...((user?.settings ?? {}) as Record<string, unknown>),
    autoRemember,
  };
  await prisma.user.update({ where: { id: userId }, data: { settings } });
}
