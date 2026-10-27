import ReactNativeBlobUtil from 'react-native-blob-util';
import { backendFetch, backendErrorMessage } from './backend';
import type { ChatAttachment } from '../types/chat';

/**
 * Attachment upload, mirroring the web composer.
 *
 * 1. `POST /api/attachments/upload-url` with the filename + MIME type; the
 *    server returns a 60-second presigned S3 PUT scoped to the user's prefix.
 * 2. Write the picked bytes to a cache file and PUT it to S3. React Native's
 *    `fetch` cannot stream a gallery URI, so the image picker hands us base64
 *    and react-native-blob-util uploads the temp file.
 * 3. Send the returned key with the chat turn; the server presigns a GET for
 *    the vision model and renders the image in the conversation.
 */

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** MIME types the vision models accept. */
export const SUPPORTED_IMAGE_TYPES = Object.keys(EXTENSIONS);

export interface UploadableImage {
  base64: string;
  mimeType: string;
  filename: string;
}

function base64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function extensionFor(mimeType: string): string {
  return EXTENSIONS[mimeType] ?? 'jpg';
}

/**
 * Detects the real format from the base64 magic bytes. The picker can report
 * `image/heic` even when `assetRepresentationMode: 'compatible'` already handed
 * us JPEG data, and an absent `type` would otherwise label PNGs as JPEG.
 */
function sniffImageMime(base64: string, fallback: string): string {
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return fallback.toLowerCase();
}

/** Keeps the stored filename's extension in sync with the detected MIME type. */
function withExtension(filename: string, mimeType: string): string {
  const base = filename.replace(/\.[^./\\]+$/, '');
  return `${base}.${extensionFor(mimeType)}`;
}

export async function uploadImage(image: UploadableImage): Promise<ChatAttachment> {
  const mimeType = sniffImageMime(image.base64, image.mimeType);
  if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error('Use a JPEG, PNG, or WebP image.');
  }
  const filename = withExtension(image.filename, mimeType);

  const presign = await backendFetch('/api/attachments/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType: mimeType }),
  });
  if (!presign.ok) {
    throw new Error(await backendErrorMessage(presign, `Could not prepare the upload (${presign.status})`));
  }

  const { url, key } = (await presign.json()) as { url: string; key: string };

  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/aurora-upload-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extensionFor(mimeType)}`;
  await ReactNativeBlobUtil.fs.writeFile(path, image.base64, 'base64');

  try {
    const put = await ReactNativeBlobUtil.fetch(
      'PUT',
      url,
      { 'Content-Type': mimeType },
      ReactNativeBlobUtil.wrap(path),
    );
    const status = put.info().status;
    if (status < 200 || status >= 300) {
      throw new Error(`Upload failed (${status})`);
    }
  } finally {
    ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
  }

  return {
    key,
    filename,
    mimeType,
    sizeBytes: base64Bytes(image.base64),
  };
}
