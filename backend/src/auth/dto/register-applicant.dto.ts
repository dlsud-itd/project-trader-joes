import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Public self-registration for applicants. Role is always 'applicant'; it is
 * not a field here.
 */
export class RegisterApplicantDto {
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
}
