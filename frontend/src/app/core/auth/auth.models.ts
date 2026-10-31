
export type StaffRole = 'manager' | 'recruiter';

export type UserRole = StaffRole | 'applicant';

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Recruitment Manager',
  recruiter: 'Recruiter',
  applicant: 'Applicant',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
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
  role: StaffRole;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface RegisterApplicantRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}


