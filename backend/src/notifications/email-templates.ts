import type { KanbanStage } from '../database/schema.js';
import { APPLICANT_STATUS_LABELS } from './applicant-status.js';

/** A ready-to-send email: HTML for mail apps, plain text as a fallback. */
export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

/** Who the email is for and which posting it is about. */
export type EmailDetails = {
  fullName: string;
  postingTitle: string;
};

/** The sentence under the status for each stage that sends an email. */
const STAGE_MESSAGES: Partial<Record<KanbanStage, string>> = {
  Interview:
    'Good news: the hiring team would like to interview you. ' +
    'They will contact you soon with the details.',
  Offer:
    'Congratulations! The hiring team would like to make you an offer. ' +
    'They will contact you soon about the next steps.',
  Rejected:
    'Thank you for your interest. After careful review, the team has ' +
    'decided not to move forward with your application for this role.',
};

const SIGN_OFF = 'The TalentFlow hiring team';

/**
 * Mail apps ignore stylesheets, so styles are inline. Colours match the
 * app's text colour (--tf-ink).
 */
const WRAPPER_STYLE =
  'font-family:Arial,sans-serif;font-size:15px;line-height:1.5;' +
  'color:#1a1530;max-width:560px';
const PARAGRAPH_STYLE = 'margin:0 0 14px';

/** Stops names or titles from being read as HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sent right after an application is submitted. */
export function applicationReceivedEmail({
  fullName,
  postingTitle,
}: EmailDetails): EmailContent {
  const lines = [
    `Hi ${fullName},`,
    `We received your application for ${postingTitle}.`,
    `Status: ${APPLICANT_STATUS_LABELS.Applied}`,
    'The hiring team will review it and let you know about any updates.',
  ];
  return {
    subject: `Application received: ${postingTitle}`,
    html: layout(lines),
    text: plainText(lines),
  };
}

/** Sent when an application moves to a stage the applicant should know. */
export function stageChangedEmail(
  { fullName, postingTitle }: EmailDetails,
  stage: KanbanStage,
): EmailContent {
  const status = APPLICANT_STATUS_LABELS[stage];
  const lines = [
    `Hi ${fullName},`,
    `There is an update on your application for ${postingTitle}.`,
    `Status: ${status}`,
    STAGE_MESSAGES[stage] ?? '',
  ].filter((line: string) => line !== '');
  return {
    subject: `Application update: ${postingTitle} (${status})`,
    html: layout(lines),
    text: plainText(lines),
  };
}

function layout(lines: string[]): string {
  const paragraphs = [...lines, SIGN_OFF]
    .map(
      (line: string) => `<p style="${PARAGRAPH_STYLE}">${escapeHtml(line)}</p>`,
    )
    .join('');
  return `<div style="${WRAPPER_STYLE}">${paragraphs}</div>`;
}

function plainText(lines: string[]): string {
  return [...lines, SIGN_OFF].join('\n\n');
}
