import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

const valid = {
  email: 'rec@example.com',
  password: 'Password123',
  first_name: 'Rico',
  last_name: 'Reyes',
  role: 'recruiter',
};

async function check(body: object) {
  const dto = plainToInstance(RegisterDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('RegisterDto', () => {
  it('accepts a valid staff account', async () => {
    expect((await check(valid)).fields).toEqual([]);
  });

  it('trims spaces around the names', async () => {
    const { dto } = await check({
      ...valid,
      first_name: ' Rico ',
      last_name: 'Reyes  ',
    });
    expect(dto.first_name).toBe('Rico');
    expect(dto.last_name).toBe('Reyes');
  });

  it('rejects names made of only spaces', async () => {
    const { fields } = await check({
      ...valid,
      first_name: '  ',
      last_name: ' ',
    });
    expect(fields.sort()).toEqual(['first_name', 'last_name']);
  });
});
