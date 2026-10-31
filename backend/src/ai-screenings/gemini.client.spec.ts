import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_GEMINI_MODEL,
  GeminiClient,
  GeminiError,
  GeminiFailure,
  RETRY_DELAYS_MS,
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
        thinkingConfig: { thinkingLevel: 'low' },
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
    await expect(clientWith({}).generateJson(request)).rejects.toMatchObject({
      message: 'GEMINI_API_KEY is not set.',
      failure: GeminiFailure.NOT_CONFIGURED,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails when Gemini gives no answer, e.g. a blocked prompt', async () => {
    fetchMock.mockResolvedValue(
      geminiReply({ candidates: [{ finishReason: 'SAFETY' }] }),
    );
    await expect(
      clientWith({ GEMINI_API_KEY: 'test-key' }).generateJson(request),
    ).rejects.toMatchObject({
      message: 'Gemini returned no answer (SAFETY).',
      failure: GeminiFailure.NO_ANSWER,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('when Gemini is busy', () => {
    const answer = () =>
      geminiReply({ candidates: [{ content: { parts: [{ text: '{}' }] } }] });

    /** Calls Gemini and skips the waits between retries. */
    const generate = async () => {
      const result = clientWith({ GEMINI_API_KEY: 'test-key' })
        .generateJson(request)
        .then(
          (text) => ({ text }),
          (error: unknown) => ({ error }),
        );
      await vi.runAllTimersAsync();
      return result;
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
    });

    afterEach(() => vi.useRealTimers());

    it.each([429, 500, 503])(
      'tries again after a %i and returns the answer',
      async (status) => {
        fetchMock
          .mockResolvedValueOnce(
            geminiReply({ error: { message: 'Try later' } }, status),
          )
          .mockResolvedValueOnce(answer());

        await expect(generate()).resolves.toEqual({ text: '{}' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
    );

    it('tries again after a network failure or timeout', async () => {
      fetchMock
        .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
        .mockResolvedValueOnce(answer());

      await expect(generate()).resolves.toEqual({ text: '{}' });
    });

    it('gives up as BUSY after the last retry', async () => {
      fetchMock.mockImplementation(async () =>
        geminiReply({ error: { message: 'High demand' } }, 503),
      );

      const { error } = (await generate()) as { error: GeminiError };

      expect(error).toBeInstanceOf(GeminiError);
      expect(error.failure).toBe(GeminiFailure.BUSY);
      expect(error.message).toMatch(/Gemini returned 503: .*High demand/);
      expect(fetchMock).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
    });

    it('does not retry once the daily quota is used up', async () => {
      fetchMock.mockResolvedValue(
        geminiReply(
          {
            error: {
              message:
                'Quota exceeded. quotaId: ' +
                'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
            },
          },
          429,
        ),
      );

      const { error } = (await generate()) as { error: GeminiError };

      expect(error.failure).toBe(GeminiFailure.DAILY_LIMIT);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a request Gemini refuses, e.g. a bad key', async () => {
      fetchMock.mockResolvedValue(
        geminiReply({ error: { message: 'API key not valid' } }, 400),
      );

      const { error } = (await generate()) as { error: GeminiError };

      expect(error.failure).toBe(GeminiFailure.REJECTED);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
