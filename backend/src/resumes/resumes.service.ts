import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import { applications, resumes } from '../database/schema.js';
import {
  cleanFileName,
  detectResumeType,
  RESUME_MAX_BYTES,
  RESUME_MIME_TYPES,
  type UploadedResumeFile,
} from './resume-file.js';

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
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Checks the file, then stores it. Each application has one resume. */
  async upload(applicationId: number, file: UploadedResumeFile | undefined) {
    if (!file || file.size === 0) {
      throw new BadRequestException('Invalid or missing resume document.');
    }
    if (file.size > RESUME_MAX_BYTES) {
      throw new BadRequestException('The resume must be 5 MB or smaller.');
    }
    const type = detectResumeType(file.buffer, file.originalname);
    if (!type) {
      throw new BadRequestException('Upload a PDF or Word (.docx) file.');
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

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(resumes)
        .values({
          application_id: applicationId,
          file_url: '',
          file_name: cleanFileName(file.originalname, type),
          mime_type: RESUME_MIME_TYPES[type],
          size_bytes: file.size,
          data: file.buffer,
        })
        .returning({ id: resumes.id });
      // The download link needs the new id, so it is set right after insert.
      const [saved] = await tx
        .update(resumes)
        .set({ file_url: `/api/resumes/${created.id}/file` })
        .where(eq(resumes.id, created.id))
        .returning(resumeInfo);
      return saved;
    });
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
