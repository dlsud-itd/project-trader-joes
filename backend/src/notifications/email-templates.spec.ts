import type { KanbanStage } from '../database/schema.js';
import {
  APPLICANT_STATUS_LABELS,
  isNotifiedStage,
} from './applicant-status.js';
import {
  applicationReceivedEmail,
  escapeHtml,
  stageChangedEmail,
} from './email-templates.js';

const details = { fullName: 'Juan Dela Cruz', postingTitle: 'QA Analyst' };

/** Stage, the label the applicant sees, and a phrase from its message. */
const STAGE_CASES: [KanbanStage, string, string][] = [
  ['Interview', 'Interview', 'interview you'],
  ['Offer', 'Offer', 'make you an offer'],
  ['Rejected', 'Closed', 'not to move forward'],
];

describe('applicant emails', () => {
  it('confirms a new application with the posting and status', () => {
    const email = applicationReceivedEmail(details);
    expect(email.subject).toBe('Application received: QA Analyst');
    expect(email.text).toContain('Hi Juan Dela Cruz,');
    expect(email.text).toContain('Status: Submitted');
    expect(email.html).toContain('Status: Submitted');
  });

  it.each(STAGE_CASES)(
    'words a move to %s as "%s" for the applicant',
    (stage: KanbanStage, label: string, sentence: string) => {
      const email = stageChangedEmail(details, stage);
      expect(email.subject).toBe(`Application update: QA Analyst (${label})`);
      expect(email.text).toContain(`Status: ${label}`);
      expect(email.text).toContain(sentence);
    },
  );

  it('does not show internal stage names like Screening as they are', () => {
    expect(APPLICANT_STATUS_LABELS.Applied).toBe('Submitted');
    expect(APPLICANT_STATUS_LABELS.Screening).toBe('Under review');
  });

  it('only emails about Interview, Offer, and Rejected', () => {
    expect(isNotifiedStage('Interview')).toBe(true);
    expect(isNotifiedStage('Offer')).toBe(true);
    expect(isNotifiedStage('Rejected')).toBe(true);
    expect(isNotifiedStage('Applied')).toBe(false);
    expect(isNotifiedStage('Screening')).toBe(false);
  });

  it('escapes names and titles in the HTML only', () => {
    const email = applicationReceivedEmail({
      fullName: '<script>alert(1)</script>',
      postingTitle: 'R&D "Lead"',
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('R&amp;D &quot;Lead&quot;');
    expect(email.text).toContain('R&D "Lead"');
  });

  it('escapes every HTML special character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
