import type { KanbanStage } from '../database/schema.js';

/**
 * How each pipeline stage is worded for the applicant. Internal stages like
 * Screening are not shown as they are. Keep these the same as the labels on
 * the applicant's My Applications page.
 */
export const APPLICANT_STATUS_LABELS: Record<KanbanStage, string> = {
  Applied: 'Submitted',
  Screening: 'Under review',
  Interview: 'Interview',
  Offer: 'Offer',
  Rejected: 'Closed',
};

/** Moving an application to one of these stages emails the applicant. */
export const NOTIFIED_STAGES: readonly KanbanStage[] = [
  'Interview',
  'Offer',
  'Rejected',
];

export function isNotifiedStage(stage: KanbanStage): boolean {
  return NOTIFIED_STAGES.includes(stage);
}
