import { Module } from '@nestjs/common';
import { JobPostingsController } from './job-postings.controller.js';
import { JobPostingsService } from './job-postings.service.js';

@Module({
  controllers: [JobPostingsController],
  providers: [JobPostingsService],
  exports: [JobPostingsService],
})
export class JobPostingsModule {}
