import { buildEmptyPdf, buildPdf } from '../../test/resume-files.js';
import {
  extractResumeText,
  MAX_RESUME_TEXT_CHARS,
  ResumeTextError,
  tidyText,
} from './resume-text.js';

describe('extractResumeText', () => {
  it('reads the text of a PDF, one row per line', async () => {
    const pdf = buildPdf(['Maria Santos (Web Developer)', 'SKILLS: Angular']);
    await expect(extractResumeText(pdf)).resolves.toBe(
      'Maria Santos (Web Developer)\nSKILLS: Angular',
    );
  });

  it('leaves the stored bytes untouched', async () => {
    const pdf = buildPdf(['Maria Santos']);
    const copy = Buffer.from(pdf);
    await extractResumeText(pdf);
    expect(pdf.equals(copy)).toBe(true);
  });

  it('fails on a PDF with no text, like a scanned image', async () => {
    await expect(extractResumeText(buildEmptyPdf())).rejects.toThrow(
      /scanned image/,
    );
  });

  it.each([
    ['a broken PDF', Buffer.from('%PDF-1.7\n%%EOF\n')],
    ['a Word file', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])],
    ['plain text', Buffer.from('hello')],
  ])('fails on %s', async (_, data) => {
    await expect(extractResumeText(data)).rejects.toBeInstanceOf(
      ResumeTextError,
    );
  });
});

describe('tidyText', () => {
  it('joins spaces and drops extra blank lines', () => {
    expect(tidyText('  Maria\t  Santos \r\n\r\n\r\n\r\nSQL\u00a0 Git  ')).toBe(
      'Maria Santos\n\nSQL Git',
    );
  });

  it('removes characters the database cannot store', () => {
    expect(tidyText('Ma\u0000ria\u0007')).toBe('Maria');
  });

  it('cuts very long text', () => {
    expect(tidyText('a'.repeat(MAX_RESUME_TEXT_CHARS + 10))).toHaveLength(
      MAX_RESUME_TEXT_CHARS,
    );
  });
});
