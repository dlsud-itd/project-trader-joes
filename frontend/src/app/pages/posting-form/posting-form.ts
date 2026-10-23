import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControlName,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import {
  JobPosting,
  JobPostingInput,
  JobPostingStatus,
  JobPostingsService,
  PostingLimit,
  splitRequirements,
} from '../../core/job-postings';
import { RequirementsInput } from '../../shared/requirements-input';

type RequirementsError = { required: string } | null;

/** At least one non-blank line. */
function requirementsRequired(
  control: AbstractControl<string>,
): RequirementsError {
  return splitRequirements(control.value).length
    ? null
    : { required: 'Add at least one requirement.' };
}

/**
 * Create (/postings/new) and edit (/postings/:id/edit) a job posting.
 * Managers only. Requirements become the AI screening criteria in Sprint 3.
 */
@Component({
  selector: 'app-posting-form',
  imports: [ReactiveFormsModule, RouterLink, RequirementsInput],
  templateUrl: './posting-form.html',
  styleUrl: './posting-form.scss',
})
export class PostingForm implements OnInit {
  private readonly postings = inject(JobPostingsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Route param; absent when creating. */
  readonly id = input<string>();

  protected readonly limit = PostingLimit;
  protected readonly status = JobPostingStatus;
  protected readonly isEditing = computed(() => this.id() !== undefined);
  protected readonly isLoading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly original = signal<JobPosting | null>(null);
  protected readonly departments = signal<string[]>([]);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: [
      '',
      {
        validators: [
          Validators.required,
          Validators.minLength(PostingLimit.TITLE_MIN),
          Validators.maxLength(PostingLimit.TITLE_MAX),
        ],
      },
    ],
    department: [
      '',
      {
        validators: [
          Validators.required,
          Validators.maxLength(PostingLimit.DEPARTMENT_MAX),
        ],
      },
    ],
    location: [
      '',
      {
        validators: [
          Validators.required,
          Validators.maxLength(PostingLimit.LOCATION_MAX),
        ],
      },
    ],
    description: [
      '',
      {
        validators: [
          Validators.required,
          Validators.minLength(PostingLimit.DESCRIPTION_MIN),
          Validators.maxLength(PostingLimit.DESCRIPTION_MAX),
        ],
      },
    ],
    requirements: ['', { validators: [requirementsRequired] }],
    status: [JobPostingStatus.OPEN],
  });

  /** Drives the live preview. */
  protected readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly preview = computed(() => {
    const merged = { ...this.form.getRawValue(), ...this.value() };
    return {
      ...merged,
      requirements: splitRequirements(merged.requirements),
    };
  });
  protected readonly descriptionLength = computed(
    () => (this.value().description ?? '').trim().length,
  );

  /** Every form field, in page order, to find the first invalid one. */
  private readonly fields = viewChildren(FormControlName);
  private readonly fieldElements = viewChildren(FormControlName, {
    read: ElementRef<HTMLElement>,
  });
  private readonly requirementsInput = viewChild(RequirementsInput);

  private isSaved = false;

  ngOnInit(): void {
    this.loadDepartments();
    const id = this.id();
    if (id !== undefined) this.loadPosting(Number(id));
  }

  hasFieldError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  /** Used by the unsaved-changes guard and the browser's leave-page prompt. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.isSaved;
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);
    const body = this.payload();
    const id = this.original()?.id;
    const request = id
      ? this.postings.update(id, body)
      : this.postings.create(body as JobPostingInput);

    request
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ job_posting }) => {
          this.isSaved = true;
          void this.router.navigate(['/postings'], {
            queryParams: {
              saved: job_posting.id,
              action: id ? 'updated' : 'created',
            },
          });
        },
        error: (err: unknown) =>
          this.error.set(apiErrorMessage(err, 'Could not save the posting.')),
      });
  }

  /** Existing departments become suggestions, so names stay consistent. */
  private loadDepartments(): void {
    this.postings
      .list()
      .pipe(
        map((all: JobPosting[]) =>
          [...new Set(all.map((p: JobPosting) => p.department))].sort(),
        ),
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((names: string[]) => this.departments.set(names));
  }

  private loadPosting(id: number): void {
    this.isLoading.set(true);
    this.postings
      .get(id)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (posting: JobPosting) => {
          this.original.set(posting);
          this.form.reset({
            title: posting.title,
            department: posting.department,
            location: posting.location,
            description: posting.description,
            requirements: posting.requirements,
            status: posting.status,
          });
        },
        error: (err: unknown) =>
          this.loadError.set(
            apiErrorMessage(err, 'Could not load this posting.'),
          ),
      });
  }

  /** Moves the cursor to the first field with an error. */
  private focusFirstInvalid(): void {
    const index = this.fields().findIndex(
      (field: FormControlName) => field.invalid,
    );
    if (index === -1) return;
    if (this.fields()[index].name === 'requirements') {
      this.requirementsInput()?.focus();
    } else {
      this.fieldElements()[index].nativeElement.focus();
    }
  }

  /** When editing, send only the fields that changed. */
  private payload(): Partial<JobPostingInput> {
    const raw = this.form.getRawValue();
    const current: JobPostingInput = {
      title: raw.title.trim(),
      department: raw.department.trim(),
      location: raw.location.trim(),
      description: raw.description.trim(),
      requirements: raw.requirements,
      status: raw.status,
    };
    const before = this.original();
    if (!before) return current;
    return Object.fromEntries(
      Object.entries(current).filter(
        ([key, value]: [string, unknown]) =>
          before[key as keyof JobPosting] !== value,
      ),
    );
  }
}
