/** The resume on file for an application (API spec V). */
export type ResumeSummary = {
  id: number;
  file_name: string;
  size_bytes: number;
  uploaded_at: string;
  /** A bundled PDF to show instead of the API file. Sample data only. */
  sample_file?: string;
};

/** The only file type the careers page accepts. */
export const RESUME_MIME_TYPE = 'application/pdf';
