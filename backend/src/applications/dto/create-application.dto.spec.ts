import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateApplicationDto } from './create-application.dto.js';

const valid = {
  job_posting_id: 1,
  full_name: 'Juan Dela Cruz',
  email: 'juan@example.com',
};

async function check(body: object) {
  const dto = plainToInstance(CreateApplicationDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('CreateApplicationDto', () => {
  it('accepts the required fields alone', async () => {
    expect((await check(valid)).fields).toEqual([]);
  });

  it('trims the name and lowercases the email', async () => {
    const { dto } = await check({
      ...valid,
      full_name: '  Juan Dela Cruz ',
      email: ' Juan@Example.COM ',
    });
    expect(dto.full_name).toBe('Juan Dela Cruz');
    expect(dto.email).toBe('juan@example.com');
  });

  it('treats blank optional fields as not given', async () => {
    const { dto, fields } = await check({
      ...valid,
      phone: '  ',
      portfolio_url: '',
      cover_note: ' ',
    });
    expect(fields).toEqual([]);
    expect(dto.phone).toBeUndefined();
    expect(dto.portfolio_url).toBeUndefined();
    expect(dto.cover_note).toBeUndefined();
  });

  it('requires a posting, a name, and a valid email', async () => {
    const { fields } = await check({
      job_posting_id: 'abc',
      full_name: 'J',
      email: 'not-an-email',
    });
    expect(fields.sort()).toEqual(['email', 'full_name', 'job_posting_id']);
  });

  it('accepts a posting id sent as text, as form posts do', async () => {
    const { dto, fields } = await check({ ...valid, job_posting_id: '7' });
    expect(fields).toEqual([]);
    expect(dto.job_posting_id).toBe(7);
  });

  it('checks the phone number format', async () => {
    expect(
      (await check({ ...valid, phone: '+63 917 123 4567' })).fields,
    ).toEqual([]);
    expect((await check({ ...valid, phone: '(02) 8123-4567' })).fields).toEqual(
      [],
    );
    expect((await check({ ...valid, phone: 'call me' })).fields).toEqual([
      'phone',
    ]);
    expect((await check({ ...valid, phone: '123' })).fields).toEqual(['phone']);
  });

  it('only accepts http(s) links with the protocol', async () => {
    expect(
      (await check({ ...valid, portfolio_url: 'https://github.com/juan' }))
        .fields,
    ).toEqual([]);
    expect(
      (await check({ ...valid, portfolio_url: 'github.com/juan' })).fields,
    ).toEqual(['portfolio_url']);
    expect(
      (await check({ ...valid, portfolio_url: 'javascript:alert(1)' })).fields,
    ).toEqual(['portfolio_url']);
  });

  it('limits the cover note to 2,000 characters', async () => {
    expect(
      (await check({ ...valid, cover_note: 'a'.repeat(2000) })).fields,
    ).toEqual([]);
    expect(
      (await check({ ...valid, cover_note: 'a'.repeat(2001) })).fields,
    ).toEqual(['cover_note']);
  });

  it('rejects fields that are not part of the form', async () => {
    expect((await check({ ...valid, kanban_stage: 'Offer' })).fields).toEqual([
      'kanban_stage',
    ]);
  });
});
