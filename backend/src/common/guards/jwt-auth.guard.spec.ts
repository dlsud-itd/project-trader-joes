import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, JwtPayload } from '../types/auth-user.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const TEST_SECRET = 'test-secret';
const WRONG_SECRET = 'wrong-secret';

type MockRequest = {
  headers: { authorization?: string };
  user?: AuthUser;
};

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: TEST_SECRET });
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(jwt, reflector);

  const recruiter: JwtPayload = {
    sub: 5,
    email: 'a@b.com',
    role: 'recruiter',
  };

  function contextFor(authorization?: string) {
    const request: MockRequest = { headers: { authorization } };
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

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid token and attaches the user', async () => {
    markPublic(false);
    const token = await jwt.signAsync(recruiter);
    const { context, request } = contextFor(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: recruiter.sub,
      email: recruiter.email,
      role: recruiter.role,
    });
  });

  it('rejects a fake token', async () => {
    markPublic(false);
    const forged = await new JwtService({ secret: WRONG_SECRET }).signAsync({
      sub: 1,
      email: 'evil@b.com',
      role: 'manager',
    });
    const { context, request } = contextFor(`Bearer ${forged}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });
});
