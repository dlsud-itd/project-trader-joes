
/** Staff roles from the user stories: Recruitment Manager and Recruiter. */
export type UserRole = 'manager' | 'recruiter';

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Recruitment Manager',
  recruiter: 'Recruiter',
};

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
}

export interface RegisterResponse {
  message: string;
  user: User;
}


