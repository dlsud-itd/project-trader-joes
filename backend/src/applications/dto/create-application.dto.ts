import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Trims text; an empty optional field becomes "not given". */
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimOptional = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * Body for POST /api/applications (API spec IV.A).
 * Applicants don't have accounts, so instead of an `applicant_id` the form
 * sends the candidate's details, which are saved as their applicant profile.
 */
export class CreateApplicationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Choose a job posting.' })
  @Min(1, { message: 'Choose a job posting.' })
  job_posting_id: number;

  @ApiProperty({ example: 'Juan Dela Cruz' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Enter your full name.' })
  @MaxLength(150, { message: 'Full name must be 150 characters or fewer.' })
  full_name: string;

  @ApiProperty({ example: 'juan@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255, { message: 'Email must be 255 characters or fewer.' })
  email: string;

  @ApiPropertyOptional({ example: '+63 917 123 4567' })
  @Transform(trimOptional)
  @IsOptional()
  @Matches(/^\+?[\d\s()-]{7,30}$/, {
    message: 'Enter a valid phone number, e.g. +63 917 123 4567.',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'https://github.com/juandelacruz' })
  @Transform(trimOptional)
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter a full link starting with https://.' },
  )
  @MaxLength(255, { message: 'Link must be 255 characters or fewer.' })
  portfolio_url?: string;

  @ApiPropertyOptional({ example: 'Two years of Angular experience.' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Cover note must be 2,000 characters or fewer.' })
  cover_note?: string;
}