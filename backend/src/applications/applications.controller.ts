import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { ApplicationsService } from './applications.service.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';

/**
 * Applications (API spec IV).
 * Candidates apply from the public careers page, so submitting is public.
 */
@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

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