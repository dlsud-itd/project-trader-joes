import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import {
  jobPostingStatusEnum,
  type JobPostingStatus,
} from '../../database/schema.js';

export const MAX_REQUIREMENTS = 25;
export const MAX_REQUIREMENT_LENGTH = 200;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Accepts requirements as one per line (or an array of strings) and stores them
 * as a clean newline-separated list: trimmed, no blanks, no duplicates.
 */
export function normalizeRequirements(value: unknown): unknown {
  const lines = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/)
      : null;
  if (!lines) return value;

  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of lines) {
    if (typeof raw !== 'string') return value; // let validation reject it
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
    const key = line.toLowerCase();
    if (line && !seen.has(key)) {
      seen.add(key);
      clean.push(line);
    }
  }
  return clean.join('\n');
}

@ValidatorConstraint({ name: 'requirementsList' })
class RequirementsList implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value === '') return false;
    const lines = value.split('\n');
    return (
      lines.length <= MAX_REQUIREMENTS &&
      lines.every((line) => line.length <= MAX_REQUIREMENT_LENGTH)
    );
  }

  defaultMessage(): string {
    return `Add 1 to ${MAX_REQUIREMENTS} requirements, each up to ${MAX_REQUIREMENT_LENGTH} characters.`;
  }
}

/** Body for POST /api/job-postings (API spec II.B). */
export class CreateJobPostingDto {
  @ApiProperty({ example: 'Software Developer' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters.' })
  @MaxLength(150, { message: 'Title must be 150 characters or fewer.' })
  title: string;

  @ApiProperty({ example: 'IT' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Enter a department.' })
  @MaxLength(100, { message: 'Department must be 100 characters or fewer.' })
  department: string;

  @ApiProperty({ example: 'Cavite' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Enter a location.' })
  @MaxLength(150, { message: 'Location must be 150 characters or fewer.' })
  location: string;

  @ApiProperty({ example: 'Develop and maintain software applications.' })
  @Transform(trim)
  @IsString()
  @MinLength(20, { message: 'Description must be at least 20 characters.' })
  @MaxLength(5000, {
    message: 'Description must be 5,000 characters or fewer.',
  })
  description: string;

  @ApiProperty({
    description:
      'One requirement per line (an array of strings is also accepted). Used by AI screening.',
    example: 'JavaScript\nSQL\nGit',
  })
  @Transform(({ value }) => normalizeRequirements(value))
  @Validate(RequirementsList)
  requirements: string;

  @ApiPropertyOptional({
    enum: jobPostingStatusEnum.enumValues,
    default: 'open',
  })
  @IsOptional()
  @IsIn(jobPostingStatusEnum.enumValues, {
    message: `Status must be one of: ${jobPostingStatusEnum.enumValues.join(', ')}.`,
  })
  status?: JobPostingStatus;
}
