/**
 * Remembers the aspect ratio of stored images for this session.
 *
 * Presigned S3 URLs carry no dimensions, and rendering 16:9 art in a 1:1 frame
 * crops it. Both generated renders and picked photos are keyed by their S3
 * object key here; the conversation poll looks the value up again.
 */
const aspects = new Map<string, number>();

export function rememberImageAspect(key: string, aspect: number): void {
  if (!key || !Number.isFinite(aspect) || aspect <= 0) return;
  aspects.set(key, aspect);
}

export function getImageAspect(key: string): number | undefined {
  return aspects.get(key);
}
