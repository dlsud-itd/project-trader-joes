import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_GEMINI_MODEL,
  GeminiClient,
  GeminiError,
} from './gemini.client.js';

const request = {
  systemPrompt: 'You screen applicants.',
  prompt: 'Requirements: ...',
  responseSchema: { type: 'OBJECT' },
};

const clientWith = (env: Record<string, string>) =>
  new GeminiClient(new ConfigService(env));

const geminiReply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('GeminiClient', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => vi.restoreAllMocks());

  it('sends the prompt with JSON output and returns the reply text', async () => {
    fetchMock.mockResolvedValue(
      geminiReply({
        candidates: [
          { content: { parts: [{ text: '{"ok":' }, { text: '1}' }] } },
        ],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40 },
      }),
    );

    const text = await clientWith({ GEMINI_API_KEY: 'test-key' }).generateJson(
      request,
    );

    expect(text).toBe('{"ok":1}');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`,
    );
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    expect(JSON.parse(init.body as string)).toEqual({
      systemInstruction: { parts: [{ text: 'You screen applicants.' }] },
      contents: [{ role: 'user', parts: [{ text: 'Requirements: ...' }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT' },
      },
    });
  });

  it('uses GEMINI_MODEL when it is set', async () => {
    fetchMock.mockResolvedValue(
      geminiReply({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
    );
    await clientWith({
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-test',
    }).generateJson(request);
    expect(fetchMock.mock.calls[0][0]).toContain('/models/gemini-test:');
  });

  it('fails without calling Gemini when there is no API key', async () => {
    await expect(clientWith({}).generateJson(request)).rejects.toThrow(
      'GEMINI_API_KEY is not set.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns an error status into a GeminiError', async () => {
    fetchMock.mockResolvedValue(
      geminiReply({ error: { message: 'Quota exceeded' } }, 429),
    );
    await expect(
      clientWith({ GEMINI_API_KEY: 'test-key' }).generateJson(request),
    ).rejects.toThrow(/Gemini returned 429: .*Quota exceeded/);
  });

  it('turns a network failure into a GeminiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      clientWith({ GEMINI_API_KEY: 'test-key' }).generateJson(request),
    ).rejects.toBeInstanceOf(GeminiError);
  });

  it('fails when Gemini gives no answer, e.g. a blocked prompt', async () => {
    fetchMock.mockResolvedValue(
      geminiReply({ candidates: [{ finishReason: 'SAFETY' }] }),
    );
    await expect(
      clientWith({ GEMINI_API_KEY: 'test-key' }).generateJson(request),
    ).rejects.toThrow('Gemini returned no answer (SAFETY).');
  });
});
