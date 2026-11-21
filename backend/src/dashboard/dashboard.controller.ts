import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { DashboardService } from './dashboard.service.js';

/** Recruiter dashboard metrics (WBS 4.5.4.1). */
@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /**
   * GET /api/dashboard — open postings, candidates, and applicants per
   * pipeline stage. Recruiters only get numbers for their assigned postings.
   */
  @Roles('manager', 'recruiter')
  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.dashboard.summary(user);
  }
}
