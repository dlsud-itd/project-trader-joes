import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import { applications, resumes } from '../database/schema.js';
import {
  cleanFileName,
  isPdf,
  RESUME_MAX_BYTES,
  RESUME_MIME_TYPE,
  type UploadedResumeFile,
} from './resume-file.js';
import { ResumeTextService } from './resume-text.service.js';

/** Every column except the file bytes, which are only read for downloads. */
const resumeInfo = {
  id: resumes.id,
  application_id: resumes.application_id,
  file_url: resumes.file_url,
  file_name: resumes.file_name,
  mime_type: resumes.mime_type,
  size_bytes: resumes.size_bytes,
  uploaded_at: resumes.uploaded_at,
};

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly resumeText: ResumeTextService,
  ) {}

  /**
   * Checks the file, stores it, then reads its text for AI screening.
   * Each application has one resume.
   */
  async upload(applicationId: number, file: UploadedResumeFile | undefined) {
    if (!file || file.size === 0) {
      throw new BadRequestException('Invalid or missing resume document.');
    }
    if (file.size > RESUME_MAX_BYTES) {
      throw new BadRequestException('The resume must be 5 MB or smaller.');
    }
    if (!isPdf(file.buffer)) {
      throw new BadRequestException('Upload a PDF file.');
    }

    const application = await this.db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
      columns: { id: true },
      with: { resume: { columns: { id: true } } },
    });
    if (!application) throw new NotFoundException('Application not found.');
    if (application.resume) {
      throw new ConflictException(
        'A resume was already uploaded for this application.',
      );
    }

    const saved = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(resumes)
        .values({
          application_id: applicationId,
          file_url: '',
          file_name: cleanFileName(file.originalname),
          mime_type: RESUME_MIME_TYPE,
          size_bytes: file.size,
          data: file.buffer,
        })
        .returning({ id: resumes.id });
      // The download link needs the new id, so it is set right after insert.
      const [updated] = await tx
        .update(resumes)
        .set({ file_url: `/api/resumes/${created.id}/file` })
        .where(eq(resumes.id, created.id))
        .returning(resumeInfo);
      return updated;
    });

    // The file is already saved, so a failure here must not fail the upload:
    // screening reads the text again when it is missing.
    await this.resumeText
      .extractAndSave({ id: saved.id, data: file.buffer })
      .catch((err: unknown) =>
        this.logger.error(`Resume ${saved.id}: text not saved`, err),
      );
    return saved;
  }

  /** The file bytes and what to call them, for staff downloads. */
  async getFile(id: number) {
    const [file] = await this.db
      .select({
        file_name: resumes.file_name,
        mime_type: resumes.mime_type,
        data: resumes.data,
      })
      .from(resumes)
      .where(eq(resumes.id, id));
    if (!file) throw new NotFoundException('Resume not found.');
    return file;
  }
}
