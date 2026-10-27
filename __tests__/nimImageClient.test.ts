/**
 * Backend image-generation client.
 *
 * `backendFetch` needs a Firebase token, so the native auth/REST modules are
 * stubbed by jest.setup.js and `fetch` is replaced per test.
 */
import { generateImage } from '../src/api/nimImageClient';

const mockFetch = jest.fn();

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

const MODEL = 'black-forest-labs/flux.1-dev';

test('posts the prompt, model, and size, then returns the stored image', async () => {
  mockFetch.mockReturnValueOnce(
    jsonResponse({
      conversationId: 'conv-1',
      messageId: 'msg-1',
      model: MODEL,
      seed: 7,
      image: {
        key: 'user/generated-1.jpg',
        url: 'https://s3.example/generated-1.jpg',
        filename: 'aurora-1.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
      },
    }),
  );

  const result = await generateImage({ prompt: 'a fox in snow', model: MODEL, size: '16:9' });

  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url.endsWith('/api/images/generate')).toBe(true);
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({
    prompt: 'a fox in snow',
    model: MODEL,
    size: '16:9',
  });

  expect(result.conversationId).toBe('conv-1');
  expect(result.image.url).toBe('https://s3.example/generated-1.jpg');
});

test('forwards an existing conversation id', async () => {
  mockFetch.mockReturnValueOnce(
    jsonResponse({
      conversationId: 'conv-2',
      messageId: 'msg-2',
      model: MODEL,
      seed: null,
      image: {
        key: 'user/generated-2.jpg',
        url: 'https://s3.example/generated-2.jpg',
        filename: 'aurora-2.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
      },
    }),
  );

  await generateImage({
    prompt: 'a lighthouse',
    model: MODEL,
    size: '1:1',
    conversationId: 'conv-2',
  });

  const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(JSON.parse(String(init.body))).toEqual({
    prompt: 'a lighthouse',
    model: MODEL,
    size: '1:1',
    conversationId: 'conv-2',
  });
});

test('surfaces the server error message', async () => {
  mockFetch.mockReturnValueOnce(
    jsonResponse({ error: 'The image model declined that prompt.' }, 422),
  );

  await expect(generateImage({ prompt: 'x', model: MODEL, size: '1:1' })).rejects.toThrow(
    'The image model declined that prompt.',
  );
});
