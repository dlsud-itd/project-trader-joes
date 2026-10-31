import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { CreateJobPostingDto } from './dto/create-job-posting.dto.js';
import { ListJobPostingsQuery } from './dto/list-job-postings.query.js';
import {
  UpdateJobPostingDto,
  UpdateJobPostingStatusDto,
} from './dto/update-job-posting.dto.js';
import { JobPostingsService } from './job-postings.service.js';

/** A non-numeric id can't match a posting, so treat it as not found. */
const postingId = () =>
  new ParseIntPipe({
    exceptionFactory: () => new NotFoundException('Job posting not found.'),
  });

/**
 * Job postings (API spec II).
 * Reading is public so the careers page can list open roles; signed-in staff
 * also see closed postings. Only recruitment managers create, edit, close, or
 * delete them.
 */
@ApiTags('Job postings')
@ApiBearerAuth()
@Controller('job-postings')
export class JobPostingsController {
  constructor(private readonly postings: JobPostingsService) {}

  /** GET /api/job-postings — API spec II.A */
  @Public()
  @Get()
  list(@Query() query: ListJobPostingsQuery, @CurrentUser() user?: AuthUser) {
    return this.postings.findAll(query, !!user);
  }

  /** GET /api/job-postings/:id */
  @Public()
  @Get(':id')
  get(@Param('id', postingId()) id: number, @CurrentUser() user?: AuthUser) {
    return this.postings.findOne(id, !!user);
  }

  /** POST /api/job-postings — API spec II.B */
  @Roles('manager')
  @Post()
  async create(
    @Body() dto: CreateJobPostingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const job_posting = await this.postings.create(dto, user.id);
    return { message: 'Job posting created successfully.', job_posting };
  }

  /** PATCH /api/job-postings/:id — edit any field. */
  @Roles('manager')
  @Patch(':id')
  async update(
    @Param('id', postingId()) id: number,
    @Body() dto: UpdateJobPostingDto,
  ) {
    const job_posting = await this.postings.update(id, dto);
    return { message: 'Job posting updated successfully.', job_posting };
  }

  /**
   * DELETE /api/job-postings/:id — only postings without applicants;
   * the rest are closed instead so their applications are kept.
   */
  @Roles('manager')
  @Delete(':id')
  async remove(@Param('id', postingId()) id: number) {
    await this.postings.remove(id);
    return { message: 'Job posting deleted.' };
  }

  /** PATCH /api/job-postings/:id/status — open or close intake. */
  @Roles('manager')
  @Patch(':id/status')
  async setStatus(
    @Param('id', postingId()) id: number,
    @Body() { status }: UpdateJobPostingStatusDto,
  ) {
    const job_posting = await this.postings.setStatus(id, status);
    return {
      message:
        status === 'open'
          ? 'Job posting reopened. It is visible on the careers page again.'
          : 'Job posting closed. It no longer accepts applications.',
      job_posting,
    };
  }
}
