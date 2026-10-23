import { Component, computed, HostListener, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api-error';
import {
  JobPosting,
  JobPostingInput,
  JobPostingStatus,
  POSTING_LIMITS as L,
  splitRequirements,
} from '../../core/job-postings/job-postings.models';
import { JobPostingsService } from '../../core/job-postings/job-postings.service';
import { RequirementsInput } from '../../shared/requirements-input/requirements-input';

const requirementsRequired = (control: { value: string }) =>
  splitRequirements(control.value).length ? null : { required: true };

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

  /** Route param; absent when creating. */
  readonly id = input<string>();

  protected readonly L = L;
  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly original = signal<JobPosting | null>(null);
  protected readonly departments = signal<string[]>([]);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: [
      '',
      [Validators.required, Validators.minLength(L.title.min), Validators.maxLength(L.title.max)],
    ],
    department: ['', [Validators.required, Validators.maxLength(L.department)]],
    location: ['', [Validators.required, Validators.maxLength(L.location)]],
    description: [
      '',
      [
        Validators.required,
        Validators.minLength(L.description.min),
        Validators.maxLength(L.description.max),
      ],
    ],
    requirements: ['', [requirementsRequired]],
    status: ['open' as JobPostingStatus],
  });

  /** Drives the live preview. */
  protected readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly preview = computed(() => {
    const v = { ...this.form.getRawValue(), ...this.value() };
    return { ...v, requirements: splitRequirements(v.requirements) };
  });
  protected readonly descriptionLength = computed(
    () => (this.value().description ?? '').trim().length,
  );

  private saved = false;

  async ngOnInit(): Promise<void> {
    // Existing departments become suggestions, so names stay consistent.
    void this.postings
      .list()
      .then((all) => this.departments.set([...new Set(all.map((p) => p.department))].sort()))
      .catch(() => undefined);

    const id = this.id();
    if (id === undefined) return;

    this.loading.set(true);
    try {
      const posting = await this.postings.get(Number(id));
      this.original.set(posting);
      this.form.reset({
        title: posting.title,
        department: posting.department,
        location: posting.location,
        description: posting.description,
        requirements: posting.requirements,
        status: posting.status,
      });
    } catch (err) {
      this.loadError.set(apiErrorMessage(err, 'Could not load this posting.'));
    } finally {
      this.loading.set(false);
    }
  }

  showError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  /** Used by the unsaved-changes guard and the browser's leave-page prompt. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saved;
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      document.querySelector<HTMLElement>('.is-invalid, [aria-invalid="true"]')?.focus();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const body = this.payload();
      const id = this.original()?.id;
      const { job_posting } = id
        ? await this.postings.update(id, body)
        : await this.postings.create(body as JobPostingInput);
      this.saved = true;
      await this.router.navigate(['/postings'], {
        queryParams: { saved: job_posting.id, action: id ? 'updated' : 'created' },
      });
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Could not save the posting.'));
    } finally {
      this.saving.set(false);
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
      Object.entries(current).filter(([key, value]) => before[key as keyof JobPosting] !== value),
    );
  }
}
