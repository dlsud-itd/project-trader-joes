import { Module } from '@nestjs/common';
import { EmailClient } from './email.client.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  providers: [EmailClient, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
