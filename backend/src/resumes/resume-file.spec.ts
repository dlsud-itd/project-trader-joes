import { cleanFileName, detectResumeType } from './resume-file.js';

const pdf = Buffer.from('%PDF-1.7\n...');
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

describe('detectResumeType', () => {
  it('recognises a PDF by its first bytes, whatever the name', () => {
    expect(detectResumeType(pdf, 'resume.pdf')).toBe('pdf');
    expect(detectResumeType(pdf, 'resume')).toBe('pdf');
  });

  it('recognises a .docx (a zip file with the .docx extension)', () => {
    expect(detectResumeType(zip, 'Resume.DOCX')).toBe('docx');
  });

  it('rejects other zip files', () => {
    expect(detectResumeType(zip, 'photos.zip')).toBeNull();
  });

  it('rejects files that only pretend to be a PDF', () => {
    expect(detectResumeType(Buffer.from('hello'), 'resume.pdf')).toBeNull();
    expect(
      detectResumeType(Buffer.from('MZ\x90\x00'), 'resume.pdf'),
    ).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(detectResumeType(Buffer.alloc(0), 'resume.pdf')).toBeNull();
  });
});

describe('cleanFileName', () => {
  it('keeps a normal name as it is', () => {
    expect(cleanFileName('Juan Dela Cruz - CV.pdf', 'pdf')).toBe(
      'Juan Dela Cruz - CV.pdf',
    );
  });

  it('drops folder paths', () => {
    expect(cleanFileName('C:\\Users\\juan\\cv.pdf', 'pdf')).toBe('cv.pdf');
    expect(cleanFileName('../../etc/cv.pdf', 'pdf')).toBe('cv.pdf');
  });

  it('removes quotes and control characters', () => {
    expect(cleanFileName('my"cv\r\n.pdf', 'pdf')).toBe('mycv.pdf');
  });

  it('keeps the end of very long names, so the extension survives', () => {
    const name = `${'a'.repeat(300)}.pdf`;
    const cleaned = cleanFileName(name, 'pdf');
    expect(cleaned).toHaveLength(255);
    expect(cleaned.endsWith('.pdf')).toBe(true);
  });

  it('falls back to a default name', () => {
    expect(cleanFileName('', 'docx')).toBe('resume.docx');
  });
});
