import type { Database } from '../database/database.module.js';
import { EmailClient, EmailError } from './email.client.js';
import type { EmailContent } from './email-templates.js';
import { NotificationsService } from './notifications.service.js';

type ApplicationRow = {
  posting: { title: string };
  profile: { full_name: string; email: string } | null;
};

const JUAN: ApplicationRow = {
  posting: { title: 'QA Analyst' },
  profile: { full_name: 'Juan Dela Cruz', email: 'juan@example.com' },
};

describe('NotificationsService', () => {
  let findFirst: ReturnType<typeof vi.fn>;
  let send: ReturnType<typeof vi.fn>;
  let service: NotificationsService;

  const sent = (): { to: string; email: EmailContent }[] =>
    (send.mock.calls as [string, EmailContent][]).map(
      ([to, email]: [string, EmailContent]) => ({ to, email }),
    );

  beforeEach(() => {
    findFirst = vi.fn().mockResolvedValue(JUAN);
    send = vi.fn().mockResolvedValue(true);
    const db = { query: { applications: { findFirst } } };
    service = new NotificationsService(
      db as unknown as Database,
      { send } as unknown as EmailClient,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('emails the applicant when their application is received', async () => {
    await service.applicationReceived(7);
    expect(sent()).toHaveLength(1);
    expect(sent()[0].to).toBe('juan@example.com');
    expect(sent()[0].email.subject).toBe('Application received: QA Analyst');
  });

  it('emails the applicant when they move to Interview', async () => {
    await service.stageChanged(7, 'Interview');
    expect(sent()[0].email.subject).toBe(
      'Application update: QA Analyst (Interview)',
    );
  });

  it('skips stages the applicant is not emailed about', async () => {
    await service.stageChanged(7, 'Screening');
    await service.stageChanged(7, 'Applied');
    expect(send).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('logs and carries on when sending fails', async () => {
    send.mockRejectedValue(new EmailError('Resend returned 500'));
    await expect(service.stageChanged(7, 'Offer')).resolves.toBeUndefined();
  });

  it('logs and carries on when the database read fails', async () => {
    findFirst.mockRejectedValue(new Error('connection lost'));
    await expect(service.applicationReceived(7)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('skips applications that have no applicant profile', async () => {
    findFirst.mockResolvedValue({ ...JUAN, profile: null });
    await service.applicationReceived(7);
    expect(send).not.toHaveBeenCalled();
  });
});
