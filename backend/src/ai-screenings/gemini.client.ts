import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Used when GEMINI_MODEL is not set. Fast and open to new API keys
 * (gemini-2.5-* is not). Any Gemini 3+ model with JSON output works.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60_000;

/**
 * How long to wait before each automatic retry of a busy call. The free
 * tier often answers 429 or 503 for a few seconds at a time.
 */
export const RETRY_DELAYS_MS = [2_000, 5_000];

/** Rate limited (429) or a temporary server problem: worth trying again. */
const BUSY_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Gemini names the daily free-tier quota "...PerDay..." in a 429 body. */
const DAILY_QUOTA = /PerDay/i;

/** Why a Gemini call failed. Only BUSY is retried automatically. */
export enum GeminiFailure {
  BUSY = 'busy',
  DAILY_LIMIT = 'daily_limit',
  NOT_CONFIGURED = 'not_configured',
  NO_ANSWER = 'no_answer',
  REJECTED = 'rejected',
}

export type GeminiRequest = {
  systemPrompt: string;
  prompt: string;
  /** Gemini `responseSchema`: the JSON shape the reply must follow. */
  responseSchema: object;
};

/** Thrown when Gemini can't be reached or doesn't return an answer. */
export class GeminiError extends Error {
  constructor(
    message: string,
    readonly failure: GeminiFailure,
  ) {
    super(message);
  }
}

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
 * Busy and timed-out calls are retried automatically (WBS 4.3.2.2).
 * Needs GEMINI_API_KEY in backend/.env (free key: https://aistudio.google.com).
 */
@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);

  constructor(private readonly config: ConfigService) {}

  async generateJson(request: GeminiRequest): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new GeminiError(
        'GEMINI_API_KEY is not set.',
        GeminiFailure.NOT_CONFIGURED,
      );
    }
    const model =
      this.config.get<string>('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.callOnce(model, apiKey, request);
      } catch (err) {
        const delay = RETRY_DELAYS_MS[attempt];
        const isBusy =
          err instanceof GeminiError && err.failure === GeminiFailure.BUSY;
        if (!isBusy || delay === undefined) throw err;
        this.logger.warn(`${err.message} Retrying in ${delay} ms.`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async callOnce(
    model: string,
    apiKey: string,
    { systemPrompt, prompt, responseSchema }: GeminiRequest,
  ): Promise<string> {
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
      // Network errors and the timeout both land here.
      throw new GeminiError(
        `Gemini request failed: ${String(err)}`,
        GeminiFailure.BUSY,
      );
    }

    if (!res.ok) {
      // The body explains the error but never contains the key.
      const detail = (await res.text()).slice(0, 500);
      throw new GeminiError(
        `Gemini returned ${res.status}: ${detail}`,
        failureForStatus(res.status, detail),
      );
    }

    const data = (await res.json()) as GenerateContentResponse;
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    if (!text) {
      throw new GeminiError(
        `Gemini returned no answer (${candidate?.finishReason ?? 'no candidates'}).`,
        GeminiFailure.NO_ANSWER,
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

function failureForStatus(status: number, detail: string): GeminiFailure {
  if (status === 429 && DAILY_QUOTA.test(detail)) {
    return GeminiFailure.DAILY_LIMIT;
  }
  return BUSY_STATUSES.has(status)
    ? GeminiFailure.BUSY
    : GeminiFailure.REJECTED;
}
