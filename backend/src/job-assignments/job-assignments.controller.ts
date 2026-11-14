import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateJobAssignmentDto } from './dto/create-job-assignment.dto.js';
import {
  ASSIGNMENT_NOT_FOUND,
  JobAssignmentsService,
} from './job-assignments.service.js';

/** A non-numeric id can't match an assignment, so treat it as not found. */
const assignmentId = () =>
  new ParseIntPipe({
    exceptionFactory: () => new NotFoundException(ASSIGNMENT_NOT_FOUND),
  });

/**
 * Job assignments (API spec III). Managers assign recruiters to postings;
 * every staff member can see who is assigned where.
 */
@ApiTags('Job assignments')
@ApiBearerAuth()
@Controller('job-assignments')
export class JobAssignmentsController {
  constructor(private readonly assignments: JobAssignmentsService) {}

  /** GET /api/job-assignments — every assignment, with the recruiter. */
  @Roles('manager', 'recruiter')
  @Get()
  list() {
    return this.assignments.findAll();
  }

  /** POST /api/job-assignments — API spec III.A */
  @Roles('manager')
  @Post()
  async assign(@Body() dto: CreateJobAssignmentDto) {
    const assignment = await this.assignments.assign(dto);
    return {
      message: 'User assigned to job posting successfully.',
      assignment,
    };
  }

  /** DELETE /api/job-assignments/:id — takes a recruiter off the posting. */
  @Roles('manager')
  @Delete(':id')
  async remove(@Param('id', assignmentId()) id: number) {
    await this.assignments.remove(id);
    return { message: 'User removed from job posting.' };
  }
}
