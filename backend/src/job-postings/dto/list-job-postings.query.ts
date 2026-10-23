import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  jobPostingStatusEnum,
  type JobPostingStatus,
} from '../../database/schema.js';

/** Query string for GET /api/job-postings. */
export class ListJobPostingsQuery {
  @ApiPropertyOptional({
    enum: jobPostingStatusEnum.enumValues,
    description:
      'Staff only. Visitors who are not signed in always get open postings.',
  })
  @IsOptional()
  @IsIn(jobPostingStatusEnum.enumValues, {
    message: `Status must be one of: ${jobPostingStatusEnum.enumValues.join(', ')}.`,
  })
  status?: JobPostingStatus;

  @ApiPropertyOptional({
    description: 'Matches title, department, or location.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;
}
