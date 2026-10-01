import Config from 'react-native-config';
import { getModelById } from '../config/nimModels';

const GENAI_BASE = 'https://ai.api.nvidia.com/v1/genai';

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
  { model, prompt }: { model: string; prompt: string },
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = Config.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      'NVIDIA_API_KEY is missing. Check your .env file and that react-native-config is linked.',
    );
  }

  const info = getModelById(model);
  // FLUX.1 rejects `aspect_ratio` (always returns 1024x1024) — don't send it.
  const body = JSON.stringify({
    prompt,
    mode: 'base',
    seed: 0, // 0 = random
    cfg_scale: info?.cfgScale ?? 5,
    steps: info?.steps ?? 30,
  });

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    signal?.addEventListener('abort', onAbort);

    xhr.open('POST', `${GENAI_BASE}/${model}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.onload = () => {
      cleanup();
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(`NIM image API error ${xhr.status}: ${xhr.responseText?.slice(0, 200) || '<no body>'}`),
        );
        return;
      }
      try {
        const json = JSON.parse(xhr.responseText);
        const b64 = json?.artifacts?.[0]?.base64;
        if (typeof b64 === 'string' && b64.length > 0) {
          resolve(`data:${sniffMime(b64)};base64,${b64}`);
          return;
        }
        const url = json?.imageURL ?? json?.image_url ?? json?.url;
        if (typeof url === 'string' && url.length > 0) {
          resolve(url);
          return;
        }
        reject(new Error('NIM image API returned no image data'));
      } catch {
        reject(new Error('Could not parse NIM image API response'));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error('Network request failed'));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error('Request timed out'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(Object.assign(new Error('Generation cancelled'), { name: 'AbortError' }));
    };

    xhr.send(body);
  });
}

/** base64 prefixes: /9j/ = JPEG, UklGR = WEBP, everything else assumed PNG. */
function sniffMime(b64: string): string {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}
