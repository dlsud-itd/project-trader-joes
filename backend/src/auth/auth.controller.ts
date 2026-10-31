import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterApplicantDto } from './dto/register-applicant.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  /** POST /api/auth/login — API spec I.A */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** POST /api/auth/register — API spec I.B. Only managers create staff accounts. */
  @ApiBearerAuth()
  @Roles('manager')
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(dto);
    return { message: 'User registered successfully.', user };
  }

  /** POST /api/auth/register-applicant — public self-registration for applicants. */
  @Public()
  @Post('register-applicant')
  async registerApplicant(@Body() dto: RegisterApplicantDto) {
    const user = await this.auth.registerApplicant(dto);
    return { message: 'Account created successfully.', user };
  }

  /** GET /api/auth/me — returns the signed-in user. Used by the frontend on page load. */
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }
}
