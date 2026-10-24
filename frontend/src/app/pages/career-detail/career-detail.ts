import { DatePipe } from '@angular/common';
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
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CareersService, PublicJobPosting } from '../../core/careers';
import { JobPostingStatus, splitRequirements } from '../../core/job-postings';

/** Public page for one open role: description, requirements, Apply. */
@Component({
  selector: 'app-career-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './career-detail.html',
  styleUrl: './career-detail.scss',
})
export class CareerDetail implements OnInit {
  private readonly careers = inject(CareersService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  /** From the route: /careers/:id */
  readonly id = input.required<string>();

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly isUnavailable = signal(false);
  protected readonly posting = signal<PublicJobPosting | null>(null);

  protected readonly requirements = computed(() =>
    splitRequirements(this.posting()?.requirements),
  );

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
          this.title.setTitle(`${posting.title} · Careers · TalentFlow`);
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
}