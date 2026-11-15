import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetRatingDto } from './set-rating.dto.js';

async function fields(body: object) {
  const errors = await validate(plainToInstance(SetRatingDto, body));
  return errors.map((e) => e.property);
}

describe('SetRatingDto', () => {
  it('accepts whole stars from 1 to 5', async () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(await fields({ rating })).toEqual([]);
    }
  });

  it('rejects anything else', async () => {
    for (const rating of [0, 6, 3.5, '4', null]) {
      expect(await fields({ rating })).toEqual(['rating']);
    }
  });
});
