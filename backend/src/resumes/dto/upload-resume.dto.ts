import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsHexadecimal, IsInt, Length, Min } from 'class-validator';

/**
 * Text fields of the multipart body for POST /api/resumes (API spec V.A).
 * The file itself is the `file` field.
 */
export class UploadResumeDto {
  @ApiProperty({ example: 101 })
  @Type(() => Number)
  @IsInt({ message: 'application_id must be a number.' })
  @Min(1, { message: 'application_id must be a number.' })
  application_id: number;

  @ApiProperty({
    description: 'The upload_token returned by POST /api/applications.',
  })
  @IsHexadecimal({ message: 'This upload link is not valid.' })
  @Length(64, 64, { message: 'This upload link is not valid.' })
  upload_token: string;
}
