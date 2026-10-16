import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../database/schema.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(role?: UserRole): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { id: 1, email: 'a@b.c', role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => vi.restoreAllMocks());

  it('allows any signed-in user when no roles are required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextFor('recruiter'))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['manager']);
    expect(guard.canActivate(contextFor('manager'))).toBe(true);
  });

  it('blocks a user whose role is not listed', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['manager']);
    expect(() => guard.canActivate(contextFor('recruiter'))).toThrow(ForbiddenException);
  });

  it('blocks a request with no user when roles are required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['manager']);
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
