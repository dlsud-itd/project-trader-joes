import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailContent } from './email-templates.js';

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;
/** How much of Resend's error reply to keep in the log. */
const MAX_ERROR_DETAIL_CHARS = 300;

/**
 * Used when EMAIL_FROM is not set. Resend's test sender works without a
 * verified domain, but then only delivers to the Resend account's own email.
 */
export const DEFAULT_EMAIL_FROM = 'TalentFlow <onboarding@resend.dev>';

/** Thrown when Resend can't be reached or refuses the email. */
export class EmailError extends Error {}

/**
 * Sends email through Resend (https://resend.com, free tier).
 * Needs RESEND_API_KEY in backend/.env; without it, email is turned off and
 * nothing is sent.
 */
@Injectable()
export class EmailClient {
  private readonly logger = new Logger(EmailClient.name);

  constructor(private readonly config: ConfigService) {}

  /** Returns false when email is turned off, true once Resend accepts it. */
  async send(
    to: string,
    { subject, html, text }: EmailContent,
  ): Promise<boolean> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.debug(`Email turned off; not sent: "${subject}"`);
      return false;
    }
    const from = this.config.get<string>('EMAIL_FROM') || DEFAULT_EMAIL_FROM;

    let res: Response;
    try {
      res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new EmailError(`Email request failed: ${String(err)}`);
    }
    if (!res.ok) {
      // The body explains the error but never contains the key.
      const detail = (await res.text()).slice(0, MAX_ERROR_DETAIL_CHARS);
      throw new EmailError(`Resend returned ${res.status}: ${detail}`);
    }
    return true;
  }
}
