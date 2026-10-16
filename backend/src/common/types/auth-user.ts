import type { UserRole } from '../../database/schema.js';

/** Claims stored in the access token. */
export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
}

/** The signed-in user attached to each authenticated request. */
export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}
