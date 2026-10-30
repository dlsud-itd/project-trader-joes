import type { RequirementMatch } from '../database/schema.js';

/**
 * Turns Gemini's JSON answer into a fit score (WBS 4.3.3.1). Anything that
 * doesn't match the response schema is rejected rather than guessed at, so a
 * bad answer becomes a failed screening that can be retried.
 */

export type ScreeningResult = {
  fit_score: number;
  explanation: string;
  requirement_matches: RequirementMatch[];
};

/** Thrown when Gemini's answer can't be used. */
export class InvalidScreeningResponseError extends Error {}

const MATCH_POINTS: Record<RequirementMatch['match'], number> = {
  met: 1,
  partial: 0.5,
  missing: 0,
};

const MAX_EVIDENCE_CHARS = 300;
const MAX_EXPLANATION_CHARS = 1_000;

/** Share of requirement points earned, as a whole number from 0 to 100. */
export function fitScore(matches: RequirementMatch[]): number {
  if (matches.length === 0) return 0;
  const points = matches.reduce((sum, m) => sum + MATCH_POINTS[m.match], 0);
  return Math.round((points / matches.length) * 100);
}

/**
 * @param text Gemini's reply (JSON, sometimes wrapped in a ```json fence).
 * @param requirements The posting's requirements, in the order sent.
 */
export function parseScreeningResult(
  text: string,
  requirements: string[],
): ScreeningResult {
  const body = readJson(text);
  if (!isRecord(body) || !Array.isArray(body.requirements)) {
    throw new InvalidScreeningResponseError('No requirements list.');
  }
  if (body.requirements.length !== requirements.length) {
    throw new InvalidScreeningResponseError(
      `Expected ${requirements.length} requirements, got ${body.requirements.length}.`,
    );
  }

  const byNumber = new Map<number, RequirementMatch>();
  for (const item of body.requirements) {
    if (!isRecord(item)) {
      throw new InvalidScreeningResponseError(
        'A requirement is not an object.',
      );
    }
    const { number, match, evidence } = item;
    if (
      typeof number !== 'number' ||
      !Number.isInteger(number) ||
      number < 1 ||
      number > requirements.length ||
      byNumber.has(number)
    ) {
      throw new InvalidScreeningResponseError(
        `Bad requirement number: ${String(number)}.`,
      );
    }
    if (match !== 'met' && match !== 'partial' && match !== 'missing') {
      throw new InvalidScreeningResponseError(`Bad match: ${String(match)}.`);
    }
    byNumber.set(number, {
      requirement: requirements[number - 1],
      match,
      evidence: cleanText(evidence, MAX_EVIDENCE_CHARS),
    });
  }

  const explanation = cleanText(body.explanation, MAX_EXPLANATION_CHARS);
  if (!explanation) {
    throw new InvalidScreeningResponseError('No explanation.');
  }

  const requirement_matches = requirements.map(
    (_, i) => byNumber.get(i + 1) as RequirementMatch,
  );
  return {
    fit_score: fitScore(requirement_matches),
    explanation,
    requirement_matches,
  };
}

function readJson(text: string): unknown {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(unfenced);
  } catch {
    throw new InvalidScreeningResponseError('Reply is not JSON.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
