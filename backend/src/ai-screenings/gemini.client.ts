import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Used when GEMINI_MODEL is not set. Fast and open to new API keys
 * (gemini-2.5-* is not). Any Gemini 3+ model with JSON output works.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60_000;

export type GeminiRequest = {
  systemPrompt: string;
  prompt: string;
  /** Gemini `responseSchema`: the JSON shape the reply must follow. */
  responseSchema: object;
};

/** Thrown when Gemini can't be reached or doesn't return an answer. */
export class GeminiError extends Error {}

type GenerateContentResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

/**
 * Calls the Gemini API (WBS 4.3.1.2) and returns the reply text.
 * Needs GEMINI_API_KEY in backend/.env (free key: https://aistudio.google.com).
 */
@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);

  constructor(private readonly config: ConfigService) {}

  async generateJson({
    systemPrompt,
    prompt,
    responseSchema,
  }: GeminiRequest): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new GeminiError('GEMINI_API_KEY is not set.');
    const model =
      this.config.get<string>('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;

    let res: Response;
    try {
      res = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema,
            // Matching requirements needs little reasoning; low is faster.
            thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new GeminiError(`Gemini request failed: ${String(err)}`);
    }

    if (!res.ok) {
      // The body explains the error but never contains the key.
      const detail = (await res.text()).slice(0, 500);
      throw new GeminiError(`Gemini returned ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as GenerateContentResponse;
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    if (!text) {
      throw new GeminiError(
        `Gemini returned no answer (${candidate?.finishReason ?? 'no candidates'}).`,
      );
    }

    const usage = data.usageMetadata;
    this.logger.log(
      `${model}: ${usage?.promptTokenCount ?? '?'} prompt + ` +
        `${usage?.candidatesTokenCount ?? '?'} reply tokens`,
    );
    return text;
  }
}
