import { AppPath } from '../app-paths';
import { KanbanStage } from './applications.models';

/**
 * Query parameters the Applications page reads to start with filters
 * already set, e.g. `/applications?stage=Interview&mine=1`. Other pages
 * (the dashboard) use them to link straight to a filtered list.
 */
export enum ApplicantParam {
  POSTING = 'posting',
  STAGE = 'stage',
  /** Days: 1, 7, or 30. */
  APPLIED = 'applied',
  /** `unrated` or `rated`, by the signed-in user. */
  REVIEW = 'review',
  /** `1`: only postings the signed-in recruiter is assigned to. */
  MINE = 'mine',
}

/** What a link to the Applications page can preset. */
export type ApplicantLinkFilters = {
  postingId?: number;
  stage?: KanbanStage;
  appliedWithinDays?: 1 | 7 | 30;
  review?: 'unrated' | 'rated';
  mine?: boolean;
};

/** A routerLink and queryParams pair for the filtered Applications page. */
export type ApplicantLink = {
  path: string;
  queryParams: Record<string, string>;
};

export function applicantLink(
  filters: ApplicantLinkFilters = {},
): ApplicantLink {
  const queryParams: Record<string, string> = {};
  if (filters.postingId !== undefined) {
    queryParams[ApplicantParam.POSTING] = String(filters.postingId);
  }
  if (filters.stage) queryParams[ApplicantParam.STAGE] = filters.stage;
  if (filters.appliedWithinDays) {
    queryParams[ApplicantParam.APPLIED] = String(filters.appliedWithinDays);
  }
  if (filters.review) queryParams[ApplicantParam.REVIEW] = filters.review;
  if (filters.mine) queryParams[ApplicantParam.MINE] = '1';
  return { path: AppPath.APPLICATIONS, queryParams };
}
