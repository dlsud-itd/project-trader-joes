import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { FitScoreCard } from '../../shared/fit-score-card';
import { ResumeViewer } from '../../shared/resume-viewer';
import { initials } from '../applications/initials';
import {
  ApplicationRow,
  SAMPLE_APPLICATIONS,
  withSampleResult,
} from '../applications/sample-applications';

/** How long a sample screening "takes". */
const SAMPLE_SCORING_MS = 1200;

/** "https://meilin.dev/" → "meilin.dev". */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * One applicant's full profile (WBS 4.4): contact details, cover note,
 * AI fit score, and their resume in an inline PDF viewer.
 */
@Component({
  selector: 'app-applicant-profile',
  imports: [DatePipe, RouterLink, FitScoreCard, ResumeViewer],
  templateUrl: './applicant-profile.html',
  styleUrl: './applicant-profile.scss',
})
export class ApplicantProfile {
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  /** From the route: /applications/:id */
  readonly id = input.required<string>();

  // TODO(Martin, Aiven Allyson): Load from GET /api/applications once it
  // exists, and drop the sample rows and sample scoring.
  private readonly rows = signal<ApplicationRow[]>(
    structuredClone(SAMPLE_APPLICATIONS),
  );

  protected readonly application = computed(
    () => this.rows().find((r) => r.id === Number(this.id())) ?? null,
  );

  protected readonly initials = computed(() =>
    initials(this.application()?.full_name ?? ''),
  );

  /** True while a (sample) screening is in flight. */
  protected readonly isScoring = signal(false);

  protected readonly displayUrl = displayUrl;

  constructor() {
    effect(() => {
      const name = this.application()?.full_name ?? 'Applicant not found';
      this.title.setTitle(`${name} · Applications · TalentFlow`);
    });
  }

  /** Sample stand-in for AiScreeningsService.screen(). */
  protected score(): void {
    const row = this.application();
    if (!row || this.isScoring()) return;
    this.isScoring.set(true);

    const timer = setTimeout(() => {
      this.isScoring.set(false);
      this.rows.update((rows) =>
        rows.map((r) => (r.id === row.id ? withSampleResult(r) : r)),
      );
    }, SAMPLE_SCORING_MS);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}
