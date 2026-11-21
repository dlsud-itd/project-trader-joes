import { NgClass } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AppPath } from '../../core/app-paths';
import {
  ApplicantStatus,
  ApplicationsService,
  MyApplication,
} from '../../core/applications';
import { AuthService } from '../../core/auth/auth.service';
import { timeAgo } from '../../core/reviews';

/** Badge modifier classes, one look per kind of status. */
enum StatusBadge {
  SUBMITTED = 'status--submitted',
  IN_PROGRESS = 'status--in-progress',
  OFFER = 'status--offer',
  CLOSED = 'status--closed',
}

const STATUS_BADGES: Record<ApplicantStatus, StatusBadge> = {
  [ApplicantStatus.SUBMITTED]: StatusBadge.SUBMITTED,
  [ApplicantStatus.UNDER_REVIEW]: StatusBadge.IN_PROGRESS,
  [ApplicantStatus.INTERVIEW]: StatusBadge.IN_PROGRESS,
  [ApplicantStatus.OFFER]: StatusBadge.OFFER,
  [ApplicantStatus.CLOSED]: StatusBadge.CLOSED,
};

/** The signed-in applicant's own applications and where each one stands. */
@Component({
  selector: 'app-my-applications',
  imports: [NgClass, RouterLink],
  templateUrl: './my-applications.html',
  styleUrl: './my-applications.scss',
})
export class MyApplications implements OnInit {
  private readonly applicationsService = inject(ApplicationsService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly careersPath = AppPath.CAREERS;
  protected readonly statusBadges = STATUS_BADGES;
  protected readonly timeAgo = timeAgo;

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly applications = signal<MyApplication[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.applicationsService
      .getMine()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list: MyApplication[]) => this.applications.set(list),
        error: (err: unknown) =>
          this.loadError.set(
            apiErrorMessage(err, 'Could not load your applications.'),
          ),
      });
  }
}
