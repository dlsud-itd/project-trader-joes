import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { JobPostingsModule } from './job-postings/job-postings.module.js';
import { HealthController } from './health/health.controller.js';
import { ResumesModule } from './resumes/resumes.module.js';
import { UsersModule } from './users/users.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { AiScreeningsModule } from './ai-screenings/ai-screenings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ResumesModule,
    UsersModule,
    AuthModule,
    JobPostingsModule,
    ApplicationsModule,
    AiScreeningsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
