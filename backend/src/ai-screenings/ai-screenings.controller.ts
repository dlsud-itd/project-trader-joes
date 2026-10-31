import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AiScreeningsService } from './ai-screenings.service.js';
import { CreateAiScreeningDto } from './dto/create-ai-screening.dto.js';

/** A non-numeric id can't match an application, so treat it as not found. */
const applicationId = () =>
  new ParseIntPipe({
    exceptionFactory: () => new NotFoundException('AI screening not found.'),
  });

/**
 * AI screenings (API spec VI). Signed-in staff score an application's resume
 * against its job posting with Gemini, and read the saved result.
 */
@ApiTags('AI screenings')
@ApiBearerAuth()
@Controller('ai-screenings')
export class AiScreeningsController {
  constructor(private readonly screenings: AiScreeningsService) {}

  /** POST /api/ai-screenings — API spec VI.A */
  @Post()
  @HttpCode(HttpStatus.OK)
  async screen(@Body() { application_id, retry }: CreateAiScreeningDto) {
    const screening = await this.screenings.screen(
      application_id,
      retry ?? false,
    );
    return { message: 'AI screening processed successfully.', screening };
  }

  /** GET /api/ai-screenings/:applicationId — the saved fit score. */
  @Get(':applicationId')
  get(@Param('applicationId', applicationId()) id: number) {
    return this.screenings.findOne(id);
  }
}
