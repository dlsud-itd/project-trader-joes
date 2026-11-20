import { ConfigService } from '@nestjs/config';
import { DEFAULT_EMAIL_FROM, EmailClient, EmailError } from './email.client.js';

const content = {
  subject: 'Application received: QA Analyst',
  html: '<p>Hi</p>',
  text: 'Hi',
};

const clientWith = (env: Record<string, string>) =>
  new EmailClient(new ConfigService(env));

describe('EmailClient', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => vi.restoreAllMocks());

  it('sends nothing when no API key is set', async () => {
    const isSent = await clientWith({}).send('juan@example.com', content);
    expect(isSent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the email to Resend with the key', async () => {
    fetchMock.mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));

    const isSent = await clientWith({ RESEND_API_KEY: 'test-key' }).send(
      'juan@example.com',
      content,
    );

    expect(isSent).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    expect(JSON.parse(init.body as string)).toEqual({
      from: DEFAULT_EMAIL_FROM,
      to: ['juan@example.com'],
      ...content,
    });
  });

  it('uses EMAIL_FROM when it is set', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const from = 'TalentFlow <jobs@talentflow.dev>';

    await clientWith({ RESEND_API_KEY: 'k', EMAIL_FROM: from }).send(
      'juan@example.com',
      content,
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).from).toBe(from);
  });

  it('throws when Resend refuses the email', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"message":"Invalid API key"}', { status: 403 }),
    );
    const sending = clientWith({ RESEND_API_KEY: 'bad' }).send(
      'juan@example.com',
      content,
    );
    await expect(sending).rejects.toThrow(EmailError);
    await expect(sending).rejects.toThrow(/403/);
  });

  it('throws when Resend cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      clientWith({ RESEND_API_KEY: 'k' }).send('juan@example.com', content),
    ).rejects.toThrow(EmailError);
  });
});
