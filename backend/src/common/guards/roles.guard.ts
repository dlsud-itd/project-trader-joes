import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../database/schema.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from '../types/auth-user.js';

/**
 * Global guard (runs after JwtAuthGuard): checks the user's role against @Roles().
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (user && required.includes(user.role)) return true;

    throw new ForbiddenException('Your role does not have access to this action.');
  }
}
