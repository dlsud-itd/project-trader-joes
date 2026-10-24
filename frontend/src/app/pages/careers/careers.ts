import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CareersService, PublicJobPosting } from '../../core/careers';
import { splitRequirements } from '../../core/job-postings';

type RequirementsPreview = { shown: string[]; more: number };

const PREVIEW_REQUIREMENTS = 3;

/** Public careers page: every open posting, with search and departments. */
@Component({
  selector: 'app-careers',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './careers.html',
  styleUrl: './careers.scss',
})
export class Careers implements OnInit {
  private readonly careers = inject(CareersService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly postings = signal<PublicJobPosting[]>([]);
  protected readonly department = signal<string | null>(null);

  protected readonly searchControl = new FormControl('', {
    nonNullable: true,
  });

  private readonly query = toSignal(this.searchControl.valueChanges, {
    initialValue: '',
  });

  protected readonly departments = computed(() =>
    [
      ...new Set(this.postings().map((p: PublicJobPosting) => p.department)),
    ].sort((a: string, b: string) => a.localeCompare(b)),
  );

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const department = this.department();
    return this.postings().filter(
      (p: PublicJobPosting) =>
        (!department || p.department === department) &&
        (!q ||
          [p.title, p.department, p.location].some((text: string) =>
            text.toLowerCase().includes(q),
          )),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.careers
      .listOpen()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list: PublicJobPosting[]) => this.postings.set(list),
        error: (err: unknown) =>
          this.loadError.set(
            apiErrorMessage(err, 'Could not load open roles.'),
          ),
      });
  }

  protected toggleDepartment(name: string): void {
    this.department.update((current: string | null) =>
      current === name ? null : name,
    );
  }

  protected clearFilters(): void {
    this.searchControl.setValue('');
    this.department.set(null);
  }

  protected requirementsPreview(
    posting: PublicJobPosting,
  ): RequirementsPreview {
    const all = splitRequirements(posting.requirements);
    return {
      shown: all.slice(0, PREVIEW_REQUIREMENTS),
      more: Math.max(0, all.length - PREVIEW_REQUIREMENTS),
    };
  }
}