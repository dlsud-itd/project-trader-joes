import { Module } from '@nestjs/common';
import { JobAssignmentsController } from './job-assignments.controller.js';
import { JobAssignmentsService } from './job-assignments.service.js';

@Module({
  controllers: [JobAssignmentsController],
  providers: [JobAssignmentsService],
})
export class JobAssignmentsModule {}
