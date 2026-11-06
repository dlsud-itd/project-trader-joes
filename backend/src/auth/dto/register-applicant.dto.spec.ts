import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterApplicantDto } from './register-applicant.dto.js';

const valid = {
  email: 'ana@example.com',
  password: 'Password123',
  first_name: 'Ana',
  last_name: 'Cruz',
};

async function check(body: object) {
  const dto = plainToInstance(RegisterApplicantDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('RegisterApplicantDto', () => {
  it('accepts a valid sign-up', async () => {
    expect((await check(valid)).fields).toEqual([]);
  });

  it('trims spaces around the names', async () => {
    const { dto, fields } = await check({
      ...valid,
      first_name: '  Ana ',
      last_name: ' Cruz  ',
    });
    expect(fields).toEqual([]);
    expect(dto.first_name).toBe('Ana');
    expect(dto.last_name).toBe('Cruz');
  });

  it('rejects names made of only spaces', async () => {
    const { fields } = await check({
      ...valid,
      first_name: '   ',
      last_name: ' ',
    });
    expect(fields.sort()).toEqual(['first_name', 'last_name']);
  });
});
