import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** Body for POST /api/job-assignments (API spec III.A). */
export class CreateJobAssignmentDto {
  @ApiProperty({ example: 1 })
  @IsInt({ message: 'Choose a job posting.' })
  @Min(1, { message: 'Choose a job posting.' })
  job_posting_id!: number;

  @ApiProperty({ example: 5 })
  @IsInt({ message: 'Choose a recruiter.' })
  @Min(1, { message: 'Choose a recruiter.' })
  user_id!: number;
}
