import { cleanFileName, isPdf } from './resume-file.js';

describe('isPdf', () => {
  it('recognises a PDF by its first bytes, whatever the name', () => {
    expect(isPdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
  });

  it('rejects Word files and other zip archives', () => {
    expect(isPdf(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBe(
      false,
    );
  });

  it('rejects files that only pretend to be a PDF', () => {
    expect(isPdf(Buffer.from('hello'))).toBe(false);
    expect(isPdf(Buffer.from('MZ\x90\x00'))).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(isPdf(Buffer.alloc(0))).toBe(false);
  });
});

describe('cleanFileName', () => {
  it('keeps a normal name as it is', () => {
    expect(cleanFileName('Juan Dela Cruz - CV.pdf')).toBe(
      'Juan Dela Cruz - CV.pdf',
    );
  });

  it('drops folder paths', () => {
    expect(cleanFileName('C:\\Users\\juan\\cv.pdf')).toBe('cv.pdf');
    expect(cleanFileName('../../etc/cv.pdf')).toBe('cv.pdf');
  });

  it('removes quotes and control characters', () => {
    expect(cleanFileName('my"cv\r\n.pdf')).toBe('mycv.pdf');
  });

  it('keeps the end of very long names, so the extension survives', () => {
    const cleaned = cleanFileName(`${'a'.repeat(300)}.pdf`);
    expect(cleaned).toHaveLength(255);
    expect(cleaned.endsWith('.pdf')).toBe(true);
  });

  it('falls back to a default name', () => {
    expect(cleanFileName('')).toBe('resume.pdf');
  });
});
