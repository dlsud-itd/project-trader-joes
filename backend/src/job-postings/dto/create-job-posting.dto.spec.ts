import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateJobPostingDto,
  MAX_REQUIREMENTS,
  normalizeRequirements,
} from './create-job-posting.dto.js';
import {
  UpdateJobPostingDto,
  UpdateJobPostingStatusDto,
} from './update-job-posting.dto.js';

const valid = {
  title: 'Software Developer',
  department: 'IT',
  location: 'Cavite',
  description: 'Develop and maintain software applications.',
  requirements: 'JavaScript\nSQL\nGit',
};

async function errorsFor<T extends object>(cls: new () => T, body: object) {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('normalizeRequirements', () => {
  it('trims lines, drops blanks and duplicates (case-insensitive)', () => {
    expect(normalizeRequirements('  SQL \n\nGit\nsql\n')).toBe('SQL\nGit');
  });

  it('strips bullet and number markers people paste in', () => {
    expect(
      normalizeRequirements('- React\n* Angular\n• Vue\n1. Node\n2) Nest'),
    ).toBe('React\nAngular\nVue\nNode\nNest');
  });

  it('keeps commas inside a requirement', () => {
    expect(normalizeRequirements('2+ years with React, Angular, or Vue')).toBe(
      '2+ years with React, Angular, or Vue',
    );
  });

  it('accepts an array of strings', () => {
    expect(normalizeRequirements([' Git ', 'Docker', ''])).toBe('Git\nDocker');
  });

  it('leaves non-string input for validation to reject', () => {
    expect(normalizeRequirements(42)).toBe(42);
    expect(normalizeRequirements(['ok', 3])).toEqual(['ok', 3]);
  });
});

describe('CreateJobPostingDto', () => {
  it('accepts the API spec sample', async () => {
    expect(
      await errorsFor(CreateJobPostingDto, { ...valid, status: 'open' }),
    ).toEqual([]);
  });

  it('defaults status by leaving it optional', async () => {
    expect(await errorsFor(CreateJobPostingDto, valid)).toEqual([]);
  });

  it('trims text fields before checking length', async () => {
    const dto = plainToInstance(CreateJobPostingDto, {
      ...valid,
      title: '   QA   ',
    });
    expect(dto.title).toBe('QA');
    expect((await validate(dto)).map((e) => e.property)).toEqual(['title']);
  });

  it('rejects empty requirements', async () => {
    expect(
      await errorsFor(CreateJobPostingDto, { ...valid, requirements: ' \n ' }),
    ).toEqual(['requirements']);
  });

  it(`rejects more than ${MAX_REQUIREMENTS} requirements`, async () => {
    const many = Array.from(
      { length: MAX_REQUIREMENTS + 1 },
      (_, i) => `Skill ${i}`,
    );
    expect(
      await errorsFor(CreateJobPostingDto, { ...valid, requirements: many }),
    ).toEqual(['requirements']);
  });

  it('rejects an unknown status', async () => {
    expect(
      await errorsFor(CreateJobPostingDto, { ...valid, status: 'draft' }),
    ).toEqual(['status']);
  });

  it('rejects missing required fields', async () => {
    expect(await errorsFor(CreateJobPostingDto, {})).toEqual([
      'title',
      'department',
      'location',
      'description',
      'requirements',
    ]);
  });
});

describe('UpdateJobPostingDto', () => {
  it('allows sending only the changed fields', async () => {
    expect(
      await errorsFor(UpdateJobPostingDto, { location: 'Makati' }),
    ).toEqual([]);
  });

  it('still validates the fields that are sent', async () => {
    expect(await errorsFor(UpdateJobPostingDto, { title: 'x' })).toEqual([
      'title',
    ]);
  });
});

describe('UpdateJobPostingStatusDto', () => {
  it('requires open or closed', async () => {
    expect(
      await errorsFor(UpdateJobPostingStatusDto, { status: 'closed' }),
    ).toEqual([]);
    expect(await errorsFor(UpdateJobPostingStatusDto, {})).toEqual(['status']);
  });
});
