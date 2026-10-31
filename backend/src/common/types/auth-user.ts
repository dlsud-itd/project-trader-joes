import type { UserRole } from '../../database/schema.js';

/** Claims stored in the access token. */
export type JwtPayload = {
  sub: number;
  email: string;
  role: UserRole;
};

/** The signed-in user attached to each authenticated request. */
export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
};
