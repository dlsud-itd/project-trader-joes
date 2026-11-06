import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim } from '../../common/transforms/trim.js';

const NAME_MAX_LENGTH = 100;
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

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Enter a first name.' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `First name must be ${NAME_MAX_LENGTH} characters or fewer.`,
  })
  first_name: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Enter a last name.' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `Last name must be ${NAME_MAX_LENGTH} characters or fewer.`,
  })
  last_name: string;
}
