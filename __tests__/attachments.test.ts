/**
 * Attachment upload: presign with the backend, PUT the bytes to S3.
 *
 * The module-level mock replaces the blob-util stub from jest.setup.js so the
 * upload call can be observed without touching the filesystem.
 */
jest.mock('react-native-blob-util', () => {
  const fetch = jest.fn(async () => ({ info: () => ({ status: 200 }) }));
  return {
    __esModule: true,
    default: {
      fs: {
        dirs: { CacheDir: '/tmp' },
        writeFile: jest.fn(async () => undefined),
        unlink: jest.fn(async () => undefined),
      },
      config: jest.fn(() => ({ fetch })),
      fetch,
      wrap: jest.fn((path: string) => `wrapped:${path}`),
    },
  };
});

import ReactNativeBlobUtil from 'react-native-blob-util';
import { uploadImage } from '../src/api/attachments';

const blob = ReactNativeBlobUtil as unknown as {
  fs: { writeFile: jest.Mock; unlink: jest.Mock };
  fetch: jest.Mock;
  wrap: jest.Mock;
};

const mockFetch = jest.fn();

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

const IMAGE = { base64: 'aGVsbG8=', mimeType: 'image/jpeg', filename: 'photo.jpg' };

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  blob.fs.writeFile.mockClear();
  blob.fs.unlink.mockClear();
  blob.fetch.mockClear();
  blob.fetch.mockResolvedValue({ info: () => ({ status: 200 }) });
});

test('presigns, uploads the temp file, and returns the stored key', async () => {
  mockFetch.mockReturnValueOnce(
    jsonResponse({ url: 'https://s3.example/put?x=1', key: 'uid/uuid-photo.jpg' }),
  );

  const result = await uploadImage(IMAGE);

  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [presignUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(presignUrl.endsWith('/api/attachments/upload-url')).toBe(true);
  expect(JSON.parse(String(init.body))).toEqual({
    filename: 'photo.jpg',
    contentType: 'image/jpeg',
  });

  expect(blob.fs.writeFile).toHaveBeenCalledWith(
    expect.stringContaining('aurora-upload-'),
    'aGVsbG8=',
    'base64',
  );
  expect(blob.fetch).toHaveBeenCalledWith(
    'PUT',
    'https://s3.example/put?x=1',
    { 'Content-Type': 'image/jpeg' },
    expect.stringContaining('wrapped:'),
  );

  expect(result).toEqual({
    key: 'uid/uuid-photo.jpg',
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 5,
  });
  expect(blob.fs.unlink).toHaveBeenCalledTimes(1);
});

test('surfaces a failed presign and never writes a file', async () => {
  mockFetch.mockReturnValueOnce(jsonResponse({ error: 'filename and contentType required' }, 400));

  await expect(uploadImage(IMAGE)).rejects.toThrow('filename and contentType required');
  expect(blob.fs.writeFile).not.toHaveBeenCalled();
});

test('reports an S3 failure and cleans up the temp file', async () => {
  mockFetch.mockReturnValueOnce(
    jsonResponse({ url: 'https://s3.example/put?x=1', key: 'uid/uuid-photo.jpg' }),
  );
  blob.fetch.mockResolvedValueOnce({ info: () => ({ status: 403 }) });

  await expect(uploadImage(IMAGE)).rejects.toThrow('Upload failed (403)');
  expect(blob.fs.unlink).toHaveBeenCalledTimes(1);
});
