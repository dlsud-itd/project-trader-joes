import { IsEmail, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { STAFF_ROLES } from '../../database/schema.js';

type StaffRole = (typeof STAFF_ROLES)[number];

/** Creates a manager or recruiter account. Applicants use RegisterApplicantDto instead. */
export class RegisterDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number.',
  })
  password: string;

  @IsString()
  @MinLength(1, { message: 'Enter a first name.' })
  @MaxLength(100)
  first_name: string;

  @IsString()
  @MinLength(1, { message: 'Enter a last name.' })
  @MaxLength(100)
  last_name: string;

  @IsIn(STAFF_ROLES, {
    message: `Role must be one of: ${STAFF_ROLES.join(', ')}.`,
  })
  role: StaffRole;
}
