import { prisma } from "../db/prisma.js";

export const MAX_TASK_TITLE_CHARS = 160;
export const MAX_TASK_DESCRIPTION_CHARS = 1_000;

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export interface TaskDraft {
  title: string;
  dueAt: Date | null;
}

const OPEN_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS"];

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, MAX_TASK_TITLE_CHARS);
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === "TODO" || value === "IN_PROGRESS" || value === "DONE" || value === "CANCELLED"
  );
}

/** Everything the user has, open items first and soonest due date on top. */
export async function listTasks(userId: string, limit = 200): Promise<TaskRecord[]> {
  const rows = await prisma.task.findMany({
    where: { userId },
    orderBy: [
      { status: "asc" },
      { dueAt: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: limit,
    select: TASK_SELECT,
  });
  return rows as TaskRecord[];
}

/** The short list folded into the chat system prompt. */
export async function listOpenTasks(userId: string, limit = 8): Promise<TaskRecord[]> {
  const rows = await prisma.task.findMany({
    where: { userId, status: { in: OPEN_STATUSES } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
    select: TASK_SELECT,
  });
  return rows as TaskRecord[];
}

export async function countOpenTasks(userId: string): Promise<number> {
  return prisma.task.count({ where: { userId, status: { in: OPEN_STATUSES } } });
}

export async function createTask(
  userId: string,
  input: { title: string; description?: string | null; dueAt?: Date | null; status?: TaskStatus },
): Promise<TaskRecord> {
  const title = normalizeTitle(input.title);
  if (title.length === 0) throw new Error("Task title is empty.");

  const description =
    input.description?.replace(/\s+/g, " ").trim().slice(0, MAX_TASK_DESCRIPTION_CHARS) || null;

  const task = await prisma.task.create({
    data: {
      userId,
      title,
      description,
      dueAt: input.dueAt ?? null,
      ...(input.status && isTaskStatus(input.status) ? { status: input.status } : {}),
    },
    select: TASK_SELECT,
  });
  return task as TaskRecord;
}

export async function updateTask(
  userId: string,
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    dueAt?: Date | null;
    status?: TaskStatus;
  },
): Promise<TaskRecord | null> {
  const existing = await prisma.task.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return null;

  const data: {
    title?: string;
    description?: string | null;
    dueAt?: Date | null;
    status?: TaskStatus;
  } = {};

  if (patch.title !== undefined) {
    const title = normalizeTitle(patch.title);
    if (title.length === 0) throw new Error("Task title is empty.");
    data.title = title;
  }
  if (patch.description !== undefined) {
    data.description =
      patch.description?.replace(/\s+/g, " ").trim().slice(0, MAX_TASK_DESCRIPTION_CHARS) || null;
  }
  if (patch.dueAt !== undefined) data.dueAt = patch.dueAt;
  if (patch.status !== undefined) {
    if (!isTaskStatus(patch.status)) throw new Error("Invalid task status.");
    data.status = patch.status;
  }

  if (Object.keys(data).length === 0) {
    const current = await prisma.task.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });
    return current as TaskRecord;
  }

  const task = await prisma.task.update({ where: { id }, data, select: TASK_SELECT });
  return task as TaskRecord;
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const result = await prisma.task.deleteMany({ where: { id, userId } });
  return result.count > 0;
}
