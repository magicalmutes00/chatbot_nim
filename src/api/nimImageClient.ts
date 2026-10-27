import { backendFetch, backendErrorMessage } from './backend';

/**
 * Image generation is served by the backend (`POST /api/images/generate`),
 * which holds the NIM key, stores the render in S3, and appends the prompt and
 * image to the conversation. The response contains a short-lived presigned URL
 * (900 s), so images are re-read from the conversation polling endpoint rather
 * than cached indefinitely.
 */

export interface GeneratedImage {
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface GenerateImageRequest {
  prompt: string;
  model: string;
  /** Must be one of the backend's IMAGE_SIZES keys: '1:1' | '16:9' | '9:16'. */
  size: string;
  /** Omit to let the server create the conversation (first image in a chat). */
  conversationId?: string | null;
}

export interface GenerateImageResult {
  conversationId: string;
  messageId: string;
  image: GeneratedImage;
  model: string;
  seed: number | null;
}

export async function generateImage(
  request: GenerateImageRequest,
  signal?: AbortSignal,
): Promise<GenerateImageResult> {
  const res = await backendFetch('/api/images/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: request.prompt,
      model: request.model,
      size: request.size,
      ...(request.conversationId ? { conversationId: request.conversationId } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(await backendErrorMessage(res, `Image generation failed (${res.status})`));
  }

  return (await res.json()) as GenerateImageResult;
}
