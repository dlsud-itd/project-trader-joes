import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without signing in.
 * If a valid token is sent anyway, the user is still attached to the request.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
