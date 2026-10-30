import { Module } from '@nestjs/common';
import { AiScreeningsController } from './ai-screenings.controller.js';
import { AiScreeningsService } from './ai-screenings.service.js';
import { GeminiClient } from './gemini.client.js';

@Module({
  controllers: [AiScreeningsController],
  providers: [AiScreeningsService, GeminiClient],
})
export class AiScreeningsModule {}
