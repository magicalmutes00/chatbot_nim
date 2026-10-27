import type { ChatAttachment, NimChatCompletionRequest } from '../types/chat';
import { BACKEND_URL, authHeaders } from './backend';

/** Whatever the stream produced before it ended (successfully or not). */
export interface StreamPartial {
  fullText: string;
  fullReasoning: string;
}

export interface StreamCallbacks {
  onToken: (delta: string) => void;
  onReasoningToken?: (delta: string) => void;
  /** The server's persisted conversation id, sent before the first token. */
  onStart?: (conversationId: string) => void;
  onDone: (fullText: string, fullReasoning: string) => void;
  /** Called on any failure; `partial` carries whatever arrived before the error. */
  onError: (err: Error, partial: StreamPartial) => void;
}

/**
 * Streams a chat completion through the Aurora backend (`POST /api/chat`),
 * which proxies NVIDIA NIM and keeps the API key server-side.
 *
 * RN STREAMING NOTE: React Native's `fetch` does not reliably expose a
 * readable `response.body` (`getReader()`) across RN/Hermes versions. Instead
 * of depending on it, this uses XMLHttpRequest incremental delivery: RN fires
 * `xhr.onprogress` as chunks arrive and accumulates them in `responseText`,
 * which works on every supported RN version — no polyfills needed.
 */
export async function streamChatCompletion(
  request: Omit<NimChatCompletionRequest, 'stream'> & {
    conversationId?: string;
    attachments?: ChatAttachment[];
  },
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  // XHR cannot await: build the authenticated headers before opening the request.
  const headers = await authHeaders({
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  });

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
          if (typeof payload.conversationId === 'string') {
            callbacks.onStart?.(payload.conversationId);
          }
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
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }

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
      ...(request.conversationId ? { conversationId: request.conversationId } : {}),
      ...(request.attachments && request.attachments.length > 0
        ? { attachments: request.attachments }
        : {}),
    };
    xhr.send(JSON.stringify(body));
  });
}

function safeBody(text: string | undefined): string {
  return text && text.length > 0 ? text : '<unreadable response body>';
}
