import { env, isNimConfigured } from "../config/env.js";
import { NimError } from "./nim.js";

/**
 * NVIDIA NIM image generation runs on the `genai` surface (not the
 * OpenAI-compatible chat API), and returns base64 artifacts.
 */
export const IMAGE_MODELS = [
  {
    id: "black-forest-labs/flux.1-dev",
    label: "FLUX.1 Dev",
    tag: "Image",
    description: "Detailed, art-directed images from a prompt",
    steps: 20,
  },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export const IMAGE_SIZES = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
} as const;

export type ImageSize = keyof typeof IMAGE_SIZES;

export function isImageModel(model: string): model is ImageModelId {
  return IMAGE_MODELS.some((m) => m.id === model);
}

export function imageModelMeta(model: string) {
  return IMAGE_MODELS.find((m) => m.id === model);
}

/** Picks a file extension/mime type from the base64 payload's magic bytes. */
export function sniffImage(buffer: Buffer): { mimeType: string; extension: string } {
  if (buffer.length > 8 && buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { mimeType: "image/png", extension: "png" };
  }
  return { mimeType: "image/jpeg", extension: "jpg" };
}

export async function generateImage(opts: {
  model: ImageModelId;
  prompt: string;
  size: ImageSize;
  seed?: number;
  signal?: AbortSignal;
}): Promise<{ buffer: Buffer; mimeType: string; extension: string; seed: number | null }> {
  if (!isNimConfigured) {
    throw new NimError(
      "NVIDIA NIM API key is not configured. Add NVIDIA_NIM_API_KEY to server/.env and restart the server.",
      503,
    );
  }

  const meta = imageModelMeta(opts.model);
  if (!meta) throw new NimError(`Unknown image model: ${opts.model}`, 400);

  const { width, height } = IMAGE_SIZES[opts.size];
  const res = await fetch(`${env.nimImageBaseUrl}/${opts.model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.nimApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt: opts.prompt,
      mode: "base",
      steps: meta.steps,
      width,
      height,
      seed: opts.seed ?? 0,
    }),
    signal: opts.signal,
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new NimError(`NVIDIA NIM image request failed (${res.status}): ${raw.slice(0, 300)}`, res.status);
  }

  let payload: { artifacts?: Array<{ base64?: string; seed?: number; finishReason?: string }> };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    throw new NimError("NVIDIA NIM returned an unreadable image response.", 502);
  }

  const artifact = payload.artifacts?.[0];
  if (!artifact?.base64) {
    throw new NimError("NVIDIA NIM did not return an image.", 502);
  }

  // FLUX reports policy refusals as a black placeholder instead of an HTTP error.
  if (artifact.finishReason && artifact.finishReason !== "SUCCESS") {
    throw new NimError(
      artifact.finishReason === "CONTENT_FILTERED"
        ? "The image model declined that prompt. Try rephrasing it without names, brands, or sensitive detail."
        : `Image generation stopped early (${artifact.finishReason}). Try a different prompt.`,
      422,
    );
  }

  const buffer = Buffer.from(artifact.base64, "base64");
  if (buffer.length === 0) throw new NimError("NVIDIA NIM returned an empty image.", 502);

  const { mimeType, extension } = sniffImage(buffer);
  return { buffer, mimeType, extension, seed: artifact.seed ?? null };
}
