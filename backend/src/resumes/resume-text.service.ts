import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import { resumes } from '../database/schema.js';
import { ResumeStorage } from './resume-storage.js';
import { extractResumeText, ResumeTextError } from './resume-text.js';

/** The parts of a stored resume that text extraction needs. */
export type ResumeFile = {
  id: number;
  data: Buffer;
};

/**
 * Resume text extraction service (WBS 4.3.2.1). Fills
 * `resumes.extracted_text` when a resume is uploaded, and again before
 * screening if that first attempt found nothing.
 */
@Injectable()
export class ResumeTextService {
  private readonly logger = new Logger(ResumeTextService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: ResumeStorage,
  ) {}

  /**
   * Reads the text out of the file and saves it with the resume.
   * Returns null when the file has no readable text; that is logged, not
   * thrown, so it never blocks an upload.
   */
  async extractAndSave({ id, data }: ResumeFile): Promise<string | null> {
    let text: string;
    try {
      text = await extractResumeText(data);
    } catch (err) {
      if (!(err instanceof ResumeTextError)) throw err;
      this.logger.warn(`Resume ${id}: ${err.message}`);
      return null;
    }
    await this.db
      .update(resumes)
      .set({ extracted_text: text })
      .where(eq(resumes.id, id));
    return text;
  }

  /** Same as extractAndSave, for a resume already saved. */
  async extractStored(resumeId: number): Promise<string | null> {
    const [row] = await this.db
      .select({
        id: resumes.id,
        storage_file_id: resumes.storage_file_id,
        data: resumes.data,
      })
      .from(resumes)
      .where(eq(resumes.id, resumeId));
    if (!row) return null;
    const data = await this.storage.read(row);
    return this.extractAndSave({ id: row.id, data });
  }
}
