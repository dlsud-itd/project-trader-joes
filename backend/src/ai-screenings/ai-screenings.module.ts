import { Module } from '@nestjs/common';
import { ResumesModule } from '../resumes/resumes.module.js';
import { AiScreeningsController } from './ai-screenings.controller.js';
import { AiScreeningsService } from './ai-screenings.service.js';
import { GeminiClient } from './gemini.client.js';
import { ScreeningQueue } from './screening-queue.js';

@Module({
  imports: [ResumesModule],
  controllers: [AiScreeningsController],
  providers: [AiScreeningsService, GeminiClient, ScreeningQueue],
})
export class AiScreeningsModule {}
