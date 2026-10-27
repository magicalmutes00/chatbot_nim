import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/plugin.js";
import { env } from "../config/env.js";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

const s3 = new S3Client({
  endpoint: env.s3Endpoint,
  region: env.s3Region,
  credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey },
  forcePathStyle: true,
});

/** Short-lived read URL so NVIDIA NIM can fetch an image attached to a chat. */
export async function presignAttachmentGet(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: env.s3Bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: 900 });
}

/** Stores a generated image (or any bytes) in the attachment bucket. */
export async function putAttachment(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function attachmentRoutes(app: FastifyInstance) {
  app.post("/api/attachments/upload-url", { preHandler: [requireAuth] }, async (request, reply) => {
    const { filename, contentType } = request.body as { filename?: string; contentType?: string };
    if (!filename || !contentType) {
      return reply.code(400).send({ error: "filename and contentType required" });
    }
    const key = `${request.user!.id}/${crypto.randomUUID()}-${filename}`;
    const cmd = new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    return { url, key };
  });
}

