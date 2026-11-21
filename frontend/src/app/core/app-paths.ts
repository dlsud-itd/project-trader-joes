/** Paths the app navigates to from code (guards, services, pages). */
export enum AppPath {
  LOGIN = '/login',
  DASHBOARD = '/dashboard',
  CAREERS = '/careers',
  APPLICANT_LOGIN = '/careers/login',
  APPLICANT_REGISTER = '/careers/register',
  MY_APPLICATIONS = '/careers/applications',
  APPLICATIONS = '/applications',
}

/** Query value roleGuard adds when it sends someone to the dashboard. */
export const ACCESS_DENIED_FLAG = 1;
