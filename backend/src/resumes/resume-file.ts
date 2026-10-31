/** 5 MB: enough for any resume, small enough to keep in the database. */
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

/** Resumes are PDF only. */
export const RESUME_MIME_TYPE = 'application/pdf';

/** The parts of a Multer upload the resume code uses. */
export type UploadedResumeFile = {
  originalname: string;
  size: number;
  buffer: Buffer;
};

const PDF_SIGNATURE = Buffer.from('%PDF-');

/**
 * Checks the first bytes of the file, not its name or the browser's MIME
 * type, which anyone can fake. Every PDF starts with "%PDF-".
 */
export function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
}

/**
 * Keeps just the file name: no folders, control characters, or quotes
 * (it ends up in a download header), and at most 255 characters.
 */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = [...base]
    .filter((char) => char !== '"' && char >= ' ' && char !== '\u007f')
    .join('')
    .trim()
    .slice(-255);
  return cleaned || 'resume.pdf';
}
