import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { RATING_MAX, RATING_MIN } from '../../database/schema.js';

const RANGE = `${RATING_MIN} to ${RATING_MAX}`;
const RATING_MESSAGE = `Choose a rating from ${RANGE} stars.`;

/** Body for PUT /api/applications/:id/rating. */
export class SetRatingDto {
  @ApiProperty({ example: 4, minimum: RATING_MIN, maximum: RATING_MAX })
  @IsInt({ message: RATING_MESSAGE })
  @Min(RATING_MIN, { message: RATING_MESSAGE })
  @Max(RATING_MAX, { message: RATING_MESSAGE })
  rating!: number;
}
