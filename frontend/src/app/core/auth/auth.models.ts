/** Staff roles from the user stories: Recruitment Manager and Recruiter. */
export enum UserRole {
  MANAGER = 'manager',
  RECRUITER = 'recruiter',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.MANAGER]: 'Recruitment Manager',
  [UserRole.RECRUITER]: 'Recruiter',
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

export type RegisterRequest = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
};

export type RegisterResponse = {
  message: string;
  user: User;
};
