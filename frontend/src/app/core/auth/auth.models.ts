/**
 * Account roles. Managers and recruiters are staff; applicants sign up on
 * the careers site.
 */
export enum UserRole {
  MANAGER = 'manager',
  RECRUITER = 'recruiter',
  APPLICANT = 'applicant',
}

/** Roles that can sign in to the staff area. */
export type StaffRole = UserRole.MANAGER | UserRole.RECRUITER;

export const STAFF_ROLES: StaffRole[] = [UserRole.MANAGER, UserRole.RECRUITER];

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.MANAGER]: 'Recruitment Manager',
  [UserRole.RECRUITER]: 'Recruiter',
  [UserRole.APPLICANT]: 'Applicant',
};

/** Why the user was signed out; sent to the login page as `?reason=`. */
export enum LogoutReason {
  EXPIRED = 'expired',
}

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  created_at: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

/** Creates a staff account (manager only). */
export type RegisterRequest = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: StaffRole;
};

/** An applicant's own sign-up from the careers site. */
export type RegisterApplicantRequest = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type RegisterResponse = {
  message: string;
  user: User;
};
