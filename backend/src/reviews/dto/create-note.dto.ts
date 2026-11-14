import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../common/transforms/trim.js';
import { NOTE_MAX_LENGTH } from '../../database/schema.js';

const MAX_LABEL = NOTE_MAX_LENGTH.toLocaleString('en-US');

/** Body for POST /api/applications/:id/notes. */
export class CreateNoteDto {
  @ApiProperty({ example: 'Strong portfolio. Ask about testing experience.' })
  @Transform(trim)
  @IsString({ message: 'Write a note first.' })
  @MinLength(1, { message: 'Write a note first.' })
  @MaxLength(NOTE_MAX_LENGTH, {
    message: `Notes must be ${MAX_LABEL} characters or fewer.`,
  })
  body!: string;
}
