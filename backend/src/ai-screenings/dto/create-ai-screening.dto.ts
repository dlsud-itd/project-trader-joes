import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/** Body for POST /api/ai-screenings (API spec VI.A). */
export class CreateAiScreeningDto {
  @ApiProperty({ example: 101 })
  @Type(() => Number)
  @IsInt({ message: 'Choose an application.' })
  @Min(1, { message: 'Choose an application.' })
  application_id: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Screen again, even if the last screening finished or failed.',
  })
  @IsOptional()
  @IsBoolean({ message: 'retry must be true or false.' })
  retry?: boolean;
}
