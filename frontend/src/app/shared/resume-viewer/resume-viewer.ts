import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { apiErrorMessage } from '../../core/api/api-error';
import { ResumesService, ResumeSummary } from '../../core/resumes';

/** Opens the browser's PDF viewer fitted to the frame's width. */
const VIEWER_PARAMS = '#toolbar=1&navpanes=0&view=FitH';

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;

/** "2.3 KB", "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}

/**
 * The applicant's resume, shown inline with the browser's PDF viewer.
 * The file is fetched as a blob so the request carries the staff token,
 * then shown from an object URL that is released when it changes.
 */
@Component({
  selector: 'app-resume-viewer',
  imports: [DatePipe],
  templateUrl: './resume-viewer.html',
  styleUrl: './resume-viewer.scss',
})
export class ResumeViewer {
  private readonly resumes = inject(ResumesService);
  private readonly sanitizer = inject(DomSanitizer);

  /** The resume on file; null when the applicant never uploaded one. */
  readonly resume = input.required<ResumeSummary | null>();
  /** Used in the frame's accessible name. */
  readonly applicantName = input('');

  protected readonly file = rxResource({
    params: () => this.resume() ?? undefined,
    stream: ({ params }) => this.resumes.getFile(params),
  });

  /** Object URL for the loaded file. */
  protected readonly fileUrl = signal<string | null>(null);

  protected readonly viewerUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.fileUrl();
    return url
      ? this.sanitizer.bypassSecurityTrustResourceUrl(url + VIEWER_PARAMS)
      : null;
  });

  protected readonly errorMessage = computed(() =>
    this.file.error()
      ? apiErrorMessage(this.file.error(), 'Could not load the resume.')
      : null,
  );

  protected readonly fileSize = computed(() => {
    const resume = this.resume();
    return resume ? formatFileSize(resume.size_bytes) : '';
  });

  constructor() {
    effect((onCleanup) => {
      const blob = this.file.hasValue() ? this.file.value() : undefined;
      if (!blob) {
        this.fileUrl.set(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      this.fileUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
  }

  protected reload(): void {
    this.file.reload();
  }
}
