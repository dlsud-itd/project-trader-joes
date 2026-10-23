/** 5 MB: enough for any resume, small enough to keep in the database. */
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

/** The parts of a Multer upload the resume code uses. */
export type UploadedResumeFile = {
  originalname: string;
  size: number;
  buffer: Buffer;
};

export type ResumeType = 'pdf' | 'docx';

export const RESUME_MIME_TYPES: Record<ResumeType, string> = {
  pdf: 'application/pdf',
  docx:
    'application/vnd.openxmlformats-officedocument.' +
    'wordprocessingml.document',
};

const PDF_SIGNATURE = Buffer.from('%PDF-');
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Works out the file type from its first bytes, not from the name or the
 * browser's MIME type, which anyone can fake. A .docx file is a zip archive,
 * so it also needs the .docx extension.
 */
export function detectResumeType(
  buffer: Buffer,
  fileName: string,
): ResumeType | null {
  if (buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    return 'pdf';
  }
  if (
    buffer.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE) &&
    /\.docx$/i.test(fileName)
  ) {
    return 'docx';
  }
  return null;
}

/**
 * Keeps just the file name: no folders, control characters, or quotes
 * (it ends up in a download header), and at most 255 characters.
 */
export function cleanFileName(name: string, type: ResumeType): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = [...base]
    .filter((char) => char !== '"' && char >= ' ' && char !== '\u007f')
    .join('')
    .trim()
    .slice(-255);
  return cleaned || `resume.${type}`;
}
