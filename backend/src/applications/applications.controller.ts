import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { ApplicationsService } from './applications.service.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { UpdateStageDto } from './dto/update-stage.dto.js';

/** A non-numeric id can't match an application, so treat it as not found. */
const applicationId = () =>
  new ParseIntPipe({
    exceptionFactory: () => new NotFoundException('Application not found.'),
  });

/**
 * Applications (API spec IV).
 * Candidates apply from the public careers page, so submitting is public;
 * only staff can see the list.
 */
@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  /**
   * GET /api/applications — every application, newest first, with the
   * candidate, posting, AI screening, ratings, and note count. Staff only.
   */
  @ApiBearerAuth()
  @Roles('manager', 'recruiter')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.applications.list(user.id);
  }

  /** GET /api/applications/:id — one application, for the profile page. */
  @ApiBearerAuth()
  @Roles('manager', 'recruiter')
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', applicationId()) id: number,
  ) {
    return this.applications.findOne(id, user.id);
  }

  /**
   * PATCH /api/applications/:id/stage — API spec IV.B
   * Managers move applicants through the pipeline; recruiters can only view.
   */
  @ApiBearerAuth()
  @Roles('manager')
  @Patch(':id/stage')
  async updateStage(
    @Param('id', applicationId()) id: number,
    @Body() { kanban_stage }: UpdateStageDto,
  ) {
    const application = await this.applications.updateStage(id, kanban_stage);
    return { message: 'Application stage updated successfully.', application };
  }

  /**
   * POST /api/applications — API spec IV.A
   * Returns `upload_token`; send it with the resume to POST /api/resumes.
   */
  @Public()
  @Post()
  async submit(@Body() dto: CreateApplicationDto) {
    const { application, upload_token } = await this.applications.submit(dto);
    return {
      message: 'Application submitted successfully.',
      application,
      upload_token,
    };
  }
}
