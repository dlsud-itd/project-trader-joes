import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuthUser } from '../types/auth-user.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

type MockRequest = {
  headers: { authorization?: string };
  user?: AuthUser;
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;

  beforeEach(() => {
    jwtService = new JwtService({ secret: 'test-secret' });
    reflector = new Reflector();
    guard = new JwtAuthGuard(jwtService, reflector);
  });

  it('should allow access to public routes without a token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockExecutionContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('rejects missing tokens on protected routes', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockExecutionContext(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should attach user to request if a valid token is provided', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const userPayload = {
      sub: 1,
      email: 'manager@talentflow.dev',
      role: 'manager',
    };
    const token = await jwtService.signAsync(userPayload);

    const request = {
      headers: { authorization: `Bearer ${token}` },
      user: undefined,
    };
    const context = createMockExecutionContext(request);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: userPayload.sub,
      email: userPayload.email,
      role: userPayload.role,
    });
  });
});

function createMockExecutionContext(
  requestObj: MockRequest | null = { headers: {}, user: undefined },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => requestObj ?? { headers: {}, user: undefined },
      getResponse: () => ({}),
    }),
    getHandler: () => {},
    getClass: () => {},
  } as unknown as ExecutionContext;
}