import { extractText } from 'unpdf';
import { isPdf } from './resume-file.js';

/**
 * Reads the plain text out of an uploaded PDF resume (WBS 4.3.2.1), so the AI
 * screening can match it against a job posting.
 */

/** Thrown when a resume file has no text that can be read. */
export class ResumeTextError extends Error {}

/** Far more than any resume needs; screening reads only the start. */
export const MAX_RESUME_TEXT_CHARS = 100_000;

/** Three or more line breaks in a row become one blank line. */
const EXTRA_BLANK_LINES = /\n{3,}/g;

/** @param data The PDF bytes, as stored for the resume. */
export async function extractResumeText(data: Buffer): Promise<string> {
  if (!isPdf(data)) throw new ResumeTextError('The file is not a PDF.');

  let raw: string;
  try {
    // PDF.js may take over the bytes it is given, so it gets a copy.
    const { text } = await extractText(new Uint8Array(data), {
      mergePages: true,
    });
    raw = text;
  } catch (err) {
    throw new ResumeTextError(`The file could not be read: ${String(err)}`);
  }

  const text = tidyText(raw);
  if (!text) {
    throw new ResumeTextError(
      'The file has no readable text. It may be a scanned image.',
    );
  }
  return text;
}

/** One line per row of text, single spaces, no runs of blank lines. */
export function tidyText(raw: string): string {
  const printable = [...raw.replace(/\r\n?/g, '\n')]
    .filter(isKeptChar)
    .join('');
  return printable
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(EXTRA_BLANK_LINES, '\n\n')
    .trim()
    .slice(0, MAX_RESUME_TEXT_CHARS);
}

/**
 * Drops control characters except tab and line break. Postgres can't store
 * \u0000 in a text column, and the rest are noise from the file format.
 */
function isKeptChar(char: string): boolean {
  if (char === '\n' || char === '\t') return true;
  return char >= ' ' && char !== '\u007f';
}
