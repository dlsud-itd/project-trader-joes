import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module.js';
import { applications, type KanbanStage } from '../database/schema.js';
import { isNotifiedStage } from './applicant-status.js';
import { EmailClient } from './email.client.js';
import {
  applicationReceivedEmail,
  type EmailContent,
  type EmailDetails,
  stageChangedEmail,
} from './email-templates.js';

/** The applicant to email, and what the email is about. */
type Recipient = EmailDetails & { email: string };

/**
 * Emails applicants about their application: once when it is submitted, and
 * when it moves to Interview, Offer, or Rejected.
 *
 * Callers don't wait: each method starts sending and returns at once, so a
 * slow or failing email never holds up or fails the request. Failures are
 * logged. The returned promise (which never rejects) is for tests.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly email: EmailClient,
  ) {}

  applicationReceived(applicationId: number): Promise<void> {
    return this.deliver(
      applicationId,
      'application received',
      applicationReceivedEmail,
    );
  }

  /** Does nothing for stages the applicant isn't emailed about. */
  stageChanged(applicationId: number, stage: KanbanStage): Promise<void> {
    if (!isNotifiedStage(stage)) return Promise.resolve();
    return this.deliver(
      applicationId,
      `moved to ${stage}`,
      (details: EmailDetails) => stageChangedEmail(details, stage),
    );
  }

  private async deliver(
    applicationId: number,
    reason: string,
    build: (details: EmailDetails) => EmailContent,
  ): Promise<void> {
    try {
      const recipient = await this.recipient(applicationId);
      if (!recipient) {
        this.logger.warn(`Application ${applicationId}: no applicant email.`);
        return;
      }
      const isSent = await this.email.send(recipient.email, build(recipient));
      if (isSent) {
        this.logger.log(`Application ${applicationId}: emailed (${reason}).`);
      }
    } catch (err) {
      this.logger.error(
        `Application ${applicationId}: email not sent (${reason}). ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  private async recipient(applicationId: number): Promise<Recipient | null> {
    const row = await this.db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
      columns: { id: true },
      with: {
        posting: { columns: { title: true } },
        profile: { columns: { full_name: true, email: true } },
      },
    });
    if (!row?.profile) return null;
    return {
      email: row.profile.email,
      fullName: row.profile.full_name,
      postingTitle: row.posting.title,
    };
  }
}
