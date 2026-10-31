import { Module } from '@nestjs/common';
import { ResumeTextService } from './resume-text.service.js';
import { ResumesController } from './resumes.controller.js';
import { ResumesService } from './resumes.service.js';

@Module({
  controllers: [ResumesController],
  providers: [ResumesService, ResumeTextService],
  exports: [ResumeTextService],
})
export class ResumesModule {}
