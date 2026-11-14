import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateNoteDto } from './create-note.dto.js';

async function check(body: object) {
  const dto = plainToInstance(CreateNoteDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('CreateNoteDto', () => {
  it('trims the note', async () => {
    const { dto, fields } = await check({ body: '  Call back Monday. ' });
    expect(fields).toEqual([]);
    expect(dto.body).toBe('Call back Monday.');
  });

  it('rejects blank, missing, and over-2,000-character notes', async () => {
    expect((await check({ body: '   ' })).fields).toEqual(['body']);
    expect((await check({})).fields).toEqual(['body']);
    expect((await check({ body: 'a'.repeat(2001) })).fields).toEqual(['body']);
    expect((await check({ body: 'a'.repeat(2000) })).fields).toEqual([]);
  });

  it('does not accept an author in the body', async () => {
    const { fields } = await check({ body: 'Hi', author_id: 2 });
    expect(fields).toEqual(['author_id']);
  });
});
