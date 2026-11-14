import { Component, computed, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../../core/auth/auth.models';
import { fullName, JobAssignmentWithUser } from '../../../core/job-assignments';

/**
 * The recruiters assigned to one job posting (WBS 4.5.2.1). Everyone sees
 * who is assigned; managers also add and remove recruiters here. Saving is
 * left to the page.
 */
@Component({
  selector: 'app-posting-assignments',
  imports: [ReactiveFormsModule],
  templateUrl: './posting-assignments.html',
  styleUrl: './posting-assignments.scss',
})
export class PostingAssignments {
  private readonly fb = inject(FormBuilder);

  /** Used in button labels, e.g. "Remove Rey Cruz from QA Analyst". */
  readonly postingTitle = input.required<string>();
  readonly assignments = input<JobAssignmentWithUser[]>([]);
  /** Every recruiter account; only loaded for managers. */
  readonly recruiters = input<User[]>([]);
  readonly canManage = input(false);
  /** True while a change to this posting is saving. */
  readonly isBusy = input(false);
  readonly currentUserId = input<number | null>(null);

  /** The chosen recruiter's user id. */
  readonly assign = output<number>();
  readonly unassign = output<JobAssignmentWithUser>();

  protected readonly form = this.fb.group({
    recruiter: this.fb.control<number | null>(null, {
      validators: [Validators.required],
    }),
  });

  /** Recruiters who are not on this posting yet. */
  protected readonly available = computed(() => {
    const assigned = new Set(
      this.assignments().map((a: JobAssignmentWithUser) => a.user_id),
    );
    return this.recruiters().filter((r: User) => !assigned.has(r.id));
  });

  protected readonly fullName = fullName;

  protected isYou(assignment: JobAssignmentWithUser): boolean {
    return assignment.user_id === this.currentUserId();
  }

  protected submit(): void {
    const userId = this.form.controls.recruiter.value;
    if (this.isBusy() || userId === null) return;
    this.assign.emit(userId);
    this.form.reset();
  }
}
