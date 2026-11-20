import { randomUUID } from 'node:crypto';
import type {
  ResumeFileLocation,
  ResumeStorage,
} from '../src/resumes/resume-storage.js';

/**
 * Stands in for the Appwrite resumes bucket in e2e tests, so they can check
 * the Appwrite path without an Appwrite project.
 */
export class FakeResumeStorage implements Pick<
  ResumeStorage,
  'isEnabled' | 'newFileId' | 'upload' | 'download' | 'remove' | 'read'
> {
  readonly files = new Map<string, { name: string; data: Buffer }>();
  /** Set to make the next upload fail, like Appwrite being down. */
  failNextUpload = false;

  isEnabled(): boolean {
    return true;
  }

  newFileId(): string {
    return randomUUID().replace(/-/g, '');
  }

  async upload(fileId: string, data: Buffer, name: string): Promise<void> {
    if (this.failNextUpload) {
      this.failNextUpload = false;
      throw new Error('Fake bucket is down.');
    }
    this.files.set(fileId, { name, data });
  }

  async download(fileId: string): Promise<Buffer> {
    const file = this.files.get(fileId);
    if (!file) throw new Error(`No file ${fileId} in the fake bucket.`);
    return file.data;
  }

  async remove(fileId: string): Promise<void> {
    this.files.delete(fileId);
  }

  async read({ storage_file_id, data }: ResumeFileLocation): Promise<Buffer> {
    if (storage_file_id) return this.download(storage_file_id);
    if (data) return data;
    throw new Error('Resume has no file.');
  }
}
