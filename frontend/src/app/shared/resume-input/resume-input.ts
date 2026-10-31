import {
  Component,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

/** Matches the API, which also checks the file's contents. */
export const RESUME_MAX_BYTES = 5 * BYTES_PER_MB;
/** Resumes are PDF only. */
export const RESUME_ACCEPT = '.pdf,application/pdf';
const RESUME_EXTENSION = /\.pdf$/i;

/** Returns why a file can't be used as a resume, or null if it's fine. */
export function resumeFileError(file: File): string | null {
  if (!RESUME_EXTENSION.test(file.name)) return 'Choose a PDF file.';
  if (file.size === 0) return 'That file is empty. Choose another one.';
  if (file.size > RESUME_MAX_BYTES) {
    return 'The resume must be 5 MB or smaller.';
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${Math.round(bytes / BYTES_PER_KB)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

/**
 * Resume picker with drag and drop. Bind the chosen file with [(file)].
 * Files with the wrong type or size are refused here, before any upload.
 */
@Component({
  selector: 'app-resume-input',
  templateUrl: './resume-input.html',
  styleUrl: './resume-input.scss',
})
export class ResumeInput {
  readonly file = model<File | null>(null);
  /** Set by the parent form when it was submitted without a file. */
  readonly isMissing = input(false);
  readonly isDisabled = input(false);
  readonly inputId = input('resume');

  protected readonly accept = RESUME_ACCEPT;
  protected readonly error = signal<string | null>(null);
  protected readonly isDragging = signal(false);
  protected readonly formatSize = formatFileSize;

  private readonly picker =
    viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected onPick(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.choose(target.files?.[0]);
    // Lets the same file be picked again after removing it.
    target.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    if (this.isDisabled()) return;
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (!this.isDisabled()) this.choose(event.dataTransfer?.files[0]);
  }

  protected remove(): void {
    this.file.set(null);
    this.error.set(null);
    this.picker().nativeElement.focus();
  }

  private choose(file: File | undefined): void {
    if (!file) return;
    const problem = resumeFileError(file);
    this.error.set(problem);
    this.file.set(problem ? null : file);
  }
}
