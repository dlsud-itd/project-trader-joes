import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../types/auth-user.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(jwt, reflector);

  function contextFor(authorization?: string) {
    const request: { headers: { authorization?: string }; user?: AuthUser } = {
      headers: { authorization },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
    return { context, request };
  }

  /** Makes the guard treat the route as @Public() (true) or private (false). */
  const markPublic = (isPublic: boolean) =>
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

  afterEach(() => vi.restoreAllMocks());

  it('lets a public route through with no token', async () => {
    markPublic(true);
    const { context, request } = contextFor();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('rejects a private route with no token', async () => {
    markPublic(false);
    const { context } = contextFor();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token and attaches the user', async () => {
    markPublic(false);
    const token = await jwt.signAsync({ sub: 5, email: 'a@b.com', role: 'recruiter' });
    const { context, request } = contextFor(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 5, email: 'a@b.com', role: 'recruiter' });
  });

  it('rejects a fake token', async () => {
    markPublic(false);
    const forged = await new JwtService({ secret: 'wrong-secret' }).signAsync({
      sub: 1,
      email: 'evil@b.com',
      role: 'manager',
    });
    const { context, request } = contextFor(`Bearer ${forged}`);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });
});

