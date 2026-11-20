import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResumeStorage } from './resume-storage.js';

const env = {
  APPWRITE_ENDPOINT: 'https://fra.cloud.appwrite.io/v1/',
  APPWRITE_PROJECT_ID: 'talentflow',
  APPWRITE_API_KEY: 'server-key',
  APPWRITE_RESUMES_BUCKET_ID: 'resumes',
};
const FILES = 'https://fra.cloud.appwrite.io/v1/storage/buckets/resumes/files';

describe('ResumeStorage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const storage = (vars: Record<string, string> = env) =>
    new ResumeStorage(new ConfigService(vars));
  const lastCall = () => fetchMock.mock.calls.at(-1)!;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('is only enabled when every APPWRITE_* variable is set', () => {
    expect(storage().isEnabled()).toBe(true);
    expect(storage({}).isEnabled()).toBe(false);
    expect(storage({ ...env, APPWRITE_API_KEY: '' }).isEnabled()).toBe(false);
  });

  it('makes file ids Appwrite accepts', () => {
    const id = storage().newFileId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(storage().newFileId()).not.toBe(id);
  });

  it('uploads to the bucket with the project and server key', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ $id: 'abc123' }, { status: 201 }),
    );
    await storage().upload('abc123', Buffer.from('%PDF-1.7'), 'cv.pdf');

    const [url, init] = lastCall();
    expect(url).toBe(FILES);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      'X-Appwrite-Project': 'talentflow',
      'X-Appwrite-Key': 'server-key',
    });
    const form = init?.body as FormData;
    expect(form.get('fileId')).toBe('abc123');
    expect((form.get('file') as File).name).toBe('cv.pdf');
    expect((form.get('file') as File).type).toBe('application/pdf');
  });

  it('downloads the file bytes', async () => {
    fetchMock.mockResolvedValue(new Response('%PDF-1.7'));
    const data = await storage().download('abc123');
    expect(data.toString()).toBe('%PDF-1.7');
    expect(lastCall()[0]).toBe(`${FILES}/abc123/download`);
  });

  it('deletes a file, and ignores one that is already gone', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await storage().remove('abc123');
    expect(lastCall()[1]?.method).toBe('DELETE');

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    await expect(storage().remove('abc123')).resolves.toBeUndefined();
  });

  it('reads a resume from Appwrite or from the database', async () => {
    const data = Buffer.from('%PDF-1.4');
    expect(await storage().read({ storage_file_id: null, data })).toBe(data);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response('%PDF-1.7'));
    const stored = await storage().read({ storage_file_id: 'abc', data: null });
    expect(stored.toString()).toBe('%PDF-1.7');
  });

  it('answers 503 when Appwrite fails or cannot be reached', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    await expect(storage().download('abc123')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(storage().download('abc123')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('answers 503 for an Appwrite file when the keys are missing', async () => {
    await expect(
      storage({}).read({ storage_file_id: 'abc123', data: null }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
