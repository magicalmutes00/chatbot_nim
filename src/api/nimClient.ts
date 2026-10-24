import type { NimChatCompletionRequest } from '../types/chat';

const BACKEND_URL = 'http://localhost:8787';

/** Whatever the stream produced before it ended (successfully or not). */
export interface StreamPartial {
  fullText: string;
  fullReasoning: string;
}

export interface StreamCallbacks {
  onToken: (delta: string) => void;
  onReasoningToken?: (delta: string) => void;
  onDone: (fullText: string, fullReasoning: string) => void;
  /** Called on any failure; `partial` carries whatever arrived before the error. */
  onError: (err: Error, partial: StreamPartial) => void;
}

/**
 * Streams a chat completion from NVIDIA NIM directly from the client.
 *
 * RN STREAMING NOTE: React Native's `fetch` does not reliably expose a
 * readable `response.body` (`getReader()`) across RN/Hermes versions. Instead
 * of depending on it, this uses XMLHttpRequest incremental delivery: RN fires
 * `xhr.onprogress` as chunks arrive and accumulates them in `responseText`,
 * which works on every supported RN version — no polyfills needed. The SSE
 * parsing is shared between both concerns via `feed()`/`parseSseLine`.
 */
export async function streamChatCompletion(
  request: Omit<NimChatCompletionRequest, 'stream'>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest();

    let processedLength = 0;
    let buffer = '';
    let fullText = '';
    let fullReasoning = '';
    let settled = false;
    let currentEvent = 'message';
    let currentData: string | null = null;

    const partial = (): StreamPartial => ({ fullText, fullReasoning });

    const onAbort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    const settleDone = () => {
      if (settled) return;
      settled = true;
      cleanup();
      callbacks.onDone(fullText, fullReasoning);
      resolve();
    };

    const settleError = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      callbacks.onError(err, partial());
      resolve();
    };

    const handleFrame = (eventName: string, data: string) => {
      try {
        const payload = JSON.parse(data);
        if (eventName === 'start') {
          // conversationId will be handled by caller via UI flow
          return;
        }
        if (eventName === 'delta' && typeof payload.text === 'string') {
          fullText += payload.text;
          callbacks.onToken(payload.text);
        } else if (eventName === 'error') {
          settleError(new Error(payload.message || 'Backend error'));
          return;
        } else if (eventName === 'done') {
          settleDone();
          return;
        }
      } catch {
        // ignore malformed frames
      }
    };

    const feed = (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          currentData = line.slice(5).trim();
        } else if (line === '' && currentData !== null) {
          handleFrame(currentEvent, currentData);
          currentEvent = 'message';
          currentData = null;
        }
      }
    };

    signal?.addEventListener('abort', onAbort);

    xhr.open('POST', `${BACKEND_URL}/api/chat`);
    xhr.responseType = 'text';
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');

    xhr.onprogress = () => {
      try {
        const chunk = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        feed(chunk);
      } catch {}
    };

    xhr.onload = () => {
      try {
        const chunk = xhr.responseText.slice(processedLength) + '\n';
        processedLength = xhr.responseText.length;
        feed(chunk);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!settled) settleDone();
      } else {
        settleError(new Error(`Backend error ${xhr.status}: ${safeBody(xhr.responseText)}`));
      }
    };

    xhr.onerror = () => settleError(new Error('Network request failed'));
    xhr.ontimeout = () => settleError(new Error('Request timed out'));
    xhr.onabort = () =>
      settleError(Object.assign(new Error('Stream cancelled'), { name: 'AbortError' }));

    const body = {
      model: request.model,
      messages: request.messages,
    };
    xhr.send(JSON.stringify(body));
  });
}

type SseParseResult = { contentDelta?: string; reasoningDelta?: string } | 'DONE' | null;

function parseSseLine(rawLine: string): SseParseResult {
  const line = rawLine.trim();
  if (!line || !line.startsWith('data:')) return null;

  const payload = line.slice('data:'.length).trim();
  if (payload === '[DONE]') return 'DONE';

  try {
    const json = JSON.parse(payload);
    const delta = json?.choices?.[0]?.delta;
    if (!delta) return null;
    return {
      contentDelta: typeof delta.content === 'string' ? delta.content : undefined,
      reasoningDelta: typeof delta.reasoning_content === 'string' ? delta.reasoning_content : undefined,
    };
  } catch {
    // Malformed/partial JSON chunk — safe to skip, next chunk will complete it
    return null;
  }
}

function safeBody(text: string | undefined): string {
  return text && text.length > 0 ? text : '<unreadable response body>';
}
