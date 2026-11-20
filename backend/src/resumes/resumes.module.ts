import { Module } from '@nestjs/common';
import { ResumeStorage } from './resume-storage.js';
import { ResumeTextService } from './resume-text.service.js';
import { ResumesController } from './resumes.controller.js';
import { ResumesService } from './resumes.service.js';

@Module({
  controllers: [ResumesController],
  providers: [ResumesService, ResumeTextService, ResumeStorage],
  exports: [ResumeTextService],
})
export class ResumesModule {}
