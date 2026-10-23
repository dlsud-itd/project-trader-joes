import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  jobPostingStatusEnum,
  type JobPostingStatus,
} from '../../database/schema.js';
import { CreateJobPostingDto } from './create-job-posting.dto.js';

/** Body for PATCH /api/job-postings/:id. Send only the fields that change. */
export class UpdateJobPostingDto extends PartialType(CreateJobPostingDto) {}

/** Body for PATCH /api/job-postings/:id/status. */
export class UpdateJobPostingStatusDto {
  @ApiProperty({ enum: jobPostingStatusEnum.enumValues })
  @IsIn(jobPostingStatusEnum.enumValues, {
    message: `Status must be one of: ${jobPostingStatusEnum.enumValues.join(', ')}.`,
  })
  status: JobPostingStatus;
}
