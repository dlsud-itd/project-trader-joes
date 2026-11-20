import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RESUME_MIME_TYPE } from './resume-file.js';

const TIMEOUT_MS = 30_000;

/** The columns of a resume row that say where its file is. */
export type ResumeFileLocation = {
  /** Set when the file is in the Appwrite bucket. */
  storage_file_id: string | null;
  /** Set when the file is still in the database (older uploads, or no Appwrite). */
  data: Buffer | null;
};

type AppwriteSettings = {
  endpoint: string;
  project: string;
  key: string;
  bucket: string;
};

/**
 * Resume files in an Appwrite Storage bucket, so the PDFs don't fill up the
 * Neon database. Only the API talks to Appwrite, with a server key; the
 * apply page uploads to POST /api/resumes as before.
 *
 * Without the APPWRITE_* variables, `isEnabled()` is false and resumes stay
 * in the database, so a local setup without Appwrite keeps working.
 */
@Injectable()
export class ResumeStorage {
  private readonly logger = new Logger(ResumeStorage.name);

  constructor(private readonly config: ConfigService) {}

  /** True when new uploads go to Appwrite instead of the database. */
  isEnabled(): boolean {
    return this.settings() !== null;
  }

  /** A new id for a file; Appwrite allows up to 36 letters and digits. */
  newFileId(): string {
    return randomUUID().replace(/-/g, '');
  }

  async upload(fileId: string, data: Buffer, name: string): Promise<void> {
    const form = new FormData();
    form.append('fileId', fileId);
    form.append(
      'file',
      new Blob([new Uint8Array(data)], { type: RESUME_MIME_TYPE }),
      name,
    );
    const res = await this.call('POST', '', form);
    await this.expectOk(res, 'upload');
  }

  async download(fileId: string): Promise<Buffer> {
    const res = await this.call('GET', `${fileId}/download`);
    await this.expectOk(res, 'download');
    return Buffer.from(await res.arrayBuffer());
  }

  /** Deletes a file, e.g. when saving its row failed. Missing is fine. */
  async remove(fileId: string): Promise<void> {
    const res = await this.call('DELETE', fileId);
    if (res.status !== 404) await this.expectOk(res, 'delete');
  }

  /** The file's bytes, from Appwrite or from the database. */
  async read({ storage_file_id, data }: ResumeFileLocation): Promise<Buffer> {
    if (storage_file_id) return this.download(storage_file_id);
    if (data) return data;
    this.logger.error('A resume row has neither a file id nor file data.');
    throw unavailable();
  }

  private settings(): AppwriteSettings | null {
    const endpoint = this.config.get<string>('APPWRITE_ENDPOINT');
    const project = this.config.get<string>('APPWRITE_PROJECT_ID');
    const key = this.config.get<string>('APPWRITE_API_KEY');
    const bucket = this.config.get<string>('APPWRITE_RESUMES_BUCKET_ID');
    if (!endpoint || !project || !key || !bucket) return null;
    return { endpoint: endpoint.replace(/\/$/, ''), project, key, bucket };
  }

  private async call(method: string, path: string, body?: FormData) {
    const settings = this.settings();
    if (!settings) {
      // Only files already in Appwrite get here, e.g. a copy of the live
      // database on a laptop without the keys.
      this.logger.error(
        'This resume is in Appwrite, but APPWRITE_* is not set.',
      );
      throw unavailable();
    }
    const url = [settings.endpoint, 'storage/buckets', settings.bucket, 'files']
      .concat(path ? [path] : [])
      .join('/');
    try {
      return await fetch(url, {
        method,
        headers: {
          'X-Appwrite-Project': settings.project,
          'X-Appwrite-Key': settings.key,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      // Network errors and the timeout both land here.
      this.logger.error(`Appwrite ${method} ${path} failed: ${String(err)}`);
      throw unavailable();
    }
  }

  private async expectOk(res: Response, action: string) {
    if (res.ok) return;
    // The body explains the error but never contains the key.
    const detail = (await res.text()).slice(0, 500);
    this.logger.error(`Appwrite ${action} returned ${res.status}: ${detail}`);
    throw unavailable();
  }
}

const unavailable = () =>
  new ServiceUnavailableException(
    'Resume storage is not available right now. Try again in a moment.',
  );
