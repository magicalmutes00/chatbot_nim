import Config from 'react-native-config';
import type { NimChatCompletionRequest } from '../types/chat';

const NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

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
  const apiKey = Config.NVIDIA_API_KEY;
  if (!apiKey) {
    callbacks.onError(
      new Error('NVIDIA_API_KEY is missing. Check your .env file and that react-native-config is linked.'),
      { fullText: '', fullReasoning: '' },
    );
    return;
  }

  await new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest();

    let processedLength = 0;
    let buffer = '';
    let fullText = '';
    let fullReasoning = '';
    let settled = false;

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

    /** Consumes a raw text chunk; returns true once [DONE] was seen. */
    const feed = (chunk: string): boolean => {
      buffer += chunk;
      const lines = buffer.split('\n');
      // keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const result = parseSseLine(line);
        if (result === null) continue;
        if (result === 'DONE') return true;
        if (result.contentDelta) {
          fullText += result.contentDelta;
          callbacks.onToken(result.contentDelta);
        }
        if (result.reasoningDelta) {
          fullReasoning += result.reasoningDelta;
          callbacks.onReasoningToken?.(result.reasoningDelta);
        }
      }
      return false;
    };

    signal?.addEventListener('abort', onAbort);

    xhr.open('POST', NIM_ENDPOINT);
    xhr.responseType = 'text';
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.setRequestHeader('Accept', 'text/event-stream');

    xhr.onprogress = () => {
      try {
        const chunk = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        // A mid-stream [DONE] just stops token callbacks early; the final
        // settle still happens in onload/onabort below.
        feed(chunk);
      } catch {
        // Malformed/partial JSON chunk — safe to skip.
      }
    };

    xhr.onload = () => {
      try {
        // Feed anything not yet delivered plus a newline so the trailing
        // buffered line ([DONE] or a data line without \n\n) is flushed.
        const chunk = xhr.responseText.slice(processedLength) + '\n';
        processedLength = xhr.responseText.length;
        feed(chunk);
      } catch {
        // ignore tail parse errors
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        settleDone();
      } else {
        settleError(new Error(`NIM API error ${xhr.status}: ${safeBody(xhr.responseText)}`));
      }
    };

    xhr.onerror = () => settleError(new Error('Network request failed'));
    xhr.ontimeout = () => settleError(new Error('Request timed out'));
    xhr.onabort = () =>
      settleError(Object.assign(new Error('Stream cancelled'), { name: 'AbortError' }));

    xhr.send(JSON.stringify({ ...request, stream: true }));
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
