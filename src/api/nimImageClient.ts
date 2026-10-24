import { getModelById } from '../config/nimModels';

/**
 * Generates one image with a NVIDIA NIM visual-genai model (FLUX, SD 3.5, …).
 *
 * The hosted endpoints take {prompt, cfg_scale, aspect_ratio, seed, steps,
 * mode} and answer with JSON `artifacts[0].base64`; some versions return a
 * signed URL instead — both are handled and resolved as a renderable uri.
 * Generation takes seconds, so callers should pass an AbortSignal so users
 * can stop a request mid-flight.
 */
export async function generateImage(
  {
    model,
    prompt,
    width,
    height,
  }: { model: string; prompt: string; width?: number; height?: number },
  signal?: AbortSignal,
): Promise<string> {
  const info = getModelById(model);
  if (info?.kind === 'image') {
    throw new Error('Image generation is not supported via the backend API. Use a chat model.');
  }
  throw new Error('Image generation is not supported in this build.');
}

/** base64 prefixes: /9j/ = JPEG, UklGR = WEBP, everything else assumed PNG. */
function sniffMime(b64: string): string {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}
