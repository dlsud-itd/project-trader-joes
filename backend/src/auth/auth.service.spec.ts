import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { User } from '../database/schema.js';
import type { PublicUser, UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  let storedUser: User;
  let users: Pick<UsersService, 'findByEmail' | 'create'>;
  let service: AuthService;

  beforeAll(async () => {
    storedUser = {
      id: 7,
      email: 'manager@talentflow.dev',
      password_hash: await bcrypt.hash('Manager123!', 4),
      first_name: 'Maria',
      last_name: 'Santos',
      role: 'manager',
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  beforeEach(() => {
    users = {
      findByEmail: vi.fn(async (email: string) =>
        email === storedUser.email ? storedUser : undefined,
      ),
      create: vi.fn(async (input) => ({ id: 9, ...input }) as unknown as PublicUser),
    };
    service = new AuthService(users as UsersService, jwt);
  });

  it('returns a token and the user without the password hash', async () => {
    const result = await service.login({
      email: 'manager@talentflow.dev',
      password: 'Manager123!',
    });

    expect(result.user).toEqual({
      id: 7,
      email: 'manager@talentflow.dev',
      first_name: 'Maria',
      last_name: 'Santos',
      role: 'manager',
    });
    expect(result.user).not.toHaveProperty('password_hash');

    const payload = await jwt.verifyAsync(result.token);
    expect(payload).toMatchObject({ sub: 7, role: 'manager' });
  });

  it('rejects a wrong password', async () => {
    await expect(
      service.login({ email: 'manager@talentflow.dev', password: 'nope' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown email with the same message', async () => {
    await expect(
      service.login({ email: 'nobody@talentflow.dev', password: 'Manager123!' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('always registers applicants with the applicant role, regardless of the DTO', async () => {
    await service.registerApplicant({
      email: 'ana@example.com',
      password: 'Password123',
      first_name: 'Ana',
      last_name: 'Cruz',
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'applicant' }),
    );
  });
});
