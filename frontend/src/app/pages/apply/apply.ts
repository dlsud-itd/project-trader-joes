import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { finalize, Observable, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import {
  ApplicationInput,
  ApplicationLimit,
  ApplicationResponse,
  CareersService,
  PHONE_PATTERN,
  PublicJobPosting,
  ResumeResponse,
  URL_PATTERN,
} from '../../core/careers';
import { JobPostingStatus } from '../../core/job-postings';
import { ResumeInput } from '../../shared/resume-input';

/** Where the applicant is in sending their application. */
enum ApplyStep {
  /** Filling in details. */
  FORM = 'form',
  /** POST /api/applications */
  SENDING = 'sending',
  /** POST /api/resumes */
  UPLOADING = 'uploading',
  /** The application is saved; only the resume needs to be sent again. */
  UPLOAD_FAILED = 'upload-failed',
  /** Both saved. */
  DONE = 'done',
}

type SavedApplication = { applicationId: number; uploadToken: string };

/** Public apply form: candidate details and resume for one open posting. */
@Component({
  selector: 'app-apply',
  imports: [ReactiveFormsModule, RouterLink, ResumeInput],
  templateUrl: './apply.html',
  styleUrl: './apply.scss',
})
export class Apply implements OnInit {
  private readonly careers = inject(CareersService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  /** From the route: /careers/:id/apply */
  readonly id = input.required<string>();

  protected readonly limit = ApplicationLimit;
  protected readonly applyStep = ApplyStep;

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly isUnavailable = signal(false);
  protected readonly posting = signal<PublicJobPosting | null>(null);
  protected readonly resume = signal<File | null>(null);
  protected readonly step = signal<ApplyStep>(ApplyStep.FORM);
  protected readonly error = signal<string | null>(null);
  protected readonly hasSubmitted = signal(false);
  protected readonly isBusy = computed(
    () =>
      this.step() === ApplyStep.SENDING || this.step() === ApplyStep.UPLOADING,
  );
  protected readonly sentTo = signal('');

  /** Kept after the application is saved, so a failed upload can be retried. */
  private saved: SavedApplication | null = null;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    full_name: [
      '',
      {
        validators: [
          Validators.required,
          Validators.minLength(ApplicationLimit.FULL_NAME_MIN),
          Validators.maxLength(ApplicationLimit.FULL_NAME_MAX),
        ],
      },
    ],
    email: [
      '',
      {
        validators: [
          Validators.required,
          Validators.email,
          Validators.maxLength(ApplicationLimit.EMAIL_MAX),
        ],
      },
    ],
    phone: ['', { validators: [Validators.pattern(PHONE_PATTERN)] }],
    portfolio_url: [
      '',
      {
        validators: [
          Validators.pattern(URL_PATTERN),
          Validators.maxLength(ApplicationLimit.PORTFOLIO_URL_MAX),
        ],
      },
    ],
    cover_note: [
      '',
      { validators: [Validators.maxLength(ApplicationLimit.COVER_NOTE_MAX)] },
    ],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.careers
      .get(Number(this.id()))
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (posting: PublicJobPosting) => {
          // Signed-in staff can fetch closed postings; visitors get a 404.
          if (posting.status !== JobPostingStatus.OPEN) {
            this.isUnavailable.set(true);
            return;
          }
          this.posting.set(posting);
          this.title.setTitle(`Apply: ${posting.title} · TalentFlow`);
        },
        error: (err: unknown) => {
          const isNotFound =
            err instanceof HttpErrorResponse &&
            err.status === HttpStatusCode.NotFound;
          if (isNotFound) {
            this.isUnavailable.set(true);
          } else {
            this.loadError.set(
              apiErrorMessage(err, 'Could not load this role.'),
            );
          }
        },
      });
  }

  hasFieldError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.hasSubmitted());
  }

  /** Sends the application, then the resume, in one chain. */
  submit(): void {
    this.hasSubmitted.set(true);
    const posting = this.posting();
    const resume = this.resume();
    if (this.form.invalid || !resume || !posting) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.step.set(ApplyStep.SENDING);
    this.careers
      .apply(this.applicationBody(posting.id))
      .pipe(
        tap((response: ApplicationResponse) => this.keepSaved(response)),
        switchMap(() => this.uploadResume(resume)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.step.set(ApplyStep.DONE),
        error: (err: unknown) => this.showSendError(err),
      });
  }

  /** "Send resume again": the application is already saved. */
  retryUpload(): void {
    const resume = this.resume();
    if (!resume) return;
    this.error.set(null);
    this.uploadResume(resume)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.step.set(ApplyStep.DONE),
        error: (err: unknown) => this.showSendError(err),
      });
  }

  /** Leaves out optional fields the applicant skipped. */
  private applicationBody(postingId: number): ApplicationInput {
    const { phone, portfolio_url, cover_note, ...required } =
      this.form.getRawValue();
    return {
      job_posting_id: postingId,
      ...required,
      ...(phone.trim() && { phone }),
      ...(portfolio_url.trim() && { portfolio_url }),
      ...(cover_note.trim() && { cover_note }),
    };
  }

  private keepSaved({ application, upload_token }: ApplicationResponse): void {
    this.saved = { applicationId: application.id, uploadToken: upload_token };
    this.sentTo.set(this.form.controls.email.value.trim());
    this.form.disable();
  }

  private uploadResume(file: File): Observable<ResumeResponse> {
    if (!this.saved) throw new Error('The application has not been saved.');
    this.step.set(ApplyStep.UPLOADING);
    const { applicationId, uploadToken } = this.saved;
    return this.careers.uploadResume(applicationId, uploadToken, file);
  }

  /** Before the application is saved, retry all; after, only the resume. */
  private showSendError(err: unknown): void {
    if (this.saved) {
      this.step.set(ApplyStep.UPLOAD_FAILED);
      this.error.set(apiErrorMessage(err, 'Your resume did not upload.'));
    } else {
      this.step.set(ApplyStep.FORM);
      this.error.set(
        apiErrorMessage(err, 'Could not send your application. Try again.'),
      );
    }
  }
}