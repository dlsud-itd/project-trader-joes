import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { JwtPayload } from '../common/types/auth-user.js';
import { UsersService, type PublicUser } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterApplicantDto } from './dto/register-applicant.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

export type LoginResult = {
  token: string;
  user: Pick<PublicUser, 'id' | 'email' | 'first_name' | 'last_name' | 'role'>;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto): Promise<LoginResult> {
    const user = await this.users.findByEmail(email);
    // Same message for unknown email and wrong password, so emails can't be
    // probed.
    const isValid =
      user && (await bcrypt.compare(password, user.password_hash));
    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      token: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    };
  }

  register(dto: RegisterDto): Promise<PublicUser> {
    return this.users.create(dto);
  }

  /**
   * Public self-registration. The role is always 'applicant', never taken
   * from the request.
   */
  registerApplicant(dto: RegisterApplicantDto): Promise<PublicUser> {
    return this.users.create({ ...dto, role: 'applicant' });
  }
}
