import {
  fitScore,
  InvalidScreeningResponseError,
  parseScreeningResult,
} from './screening-result.js';

const requirements = ['JavaScript', 'SQL', 'Git'];

const reply = (body: unknown) => JSON.stringify(body);

const valid = {
  requirements: [
    { number: 1, match: 'met', evidence: 'Built a React app in JavaScript.' },
    { number: 2, match: 'partial', evidence: 'Took a databases course.' },
    { number: 3, match: 'missing', evidence: 'No version control mentioned.' },
  ],
  explanation: 'Strong JavaScript; some SQL; no Git.',
};

describe('fitScore', () => {
  it('counts met as 1, partial as 0.5, missing as 0', () => {
    expect(
      fitScore([
        { requirement: 'a', match: 'met', evidence: '' },
        { requirement: 'b', match: 'partial', evidence: '' },
        { requirement: 'c', match: 'missing', evidence: '' },
      ]),
    ).toBe(50);
  });

  it('rounds to a whole number', () => {
    expect(
      fitScore([
        { requirement: 'a', match: 'met', evidence: '' },
        { requirement: 'b', match: 'met', evidence: '' },
        { requirement: 'c', match: 'missing', evidence: '' },
      ]),
    ).toBe(67);
  });

  it('is 0 with no requirements', () => {
    expect(fitScore([])).toBe(0);
  });
});

describe('parseScreeningResult', () => {
  it('scores a valid reply and keeps the posting’s requirement text', () => {
    expect(parseScreeningResult(reply(valid), requirements)).toEqual({
      fit_score: 50,
      explanation: 'Strong JavaScript; some SQL; no Git.',
      requirement_matches: [
        {
          requirement: 'JavaScript',
          match: 'met',
          evidence: 'Built a React app in JavaScript.',
        },
        {
          requirement: 'SQL',
          match: 'partial',
          evidence: 'Took a databases course.',
        },
        {
          requirement: 'Git',
          match: 'missing',
          evidence: 'No version control mentioned.',
        },
      ],
    });
  });

  it('puts requirements back in posting order', () => {
    const shuffled = {
      ...valid,
      requirements: [...valid.requirements].reverse(),
    };
    const result = parseScreeningResult(reply(shuffled), requirements);
    expect(result.requirement_matches.map((m) => m.requirement)).toEqual(
      requirements,
    );
  });

  it('accepts JSON wrapped in a code fence', () => {
    const fenced = '```json\n' + reply(valid) + '\n```';
    expect(parseScreeningResult(fenced, requirements).fit_score).toBe(50);
  });

  it('tidies whitespace and shortens long text', () => {
    const messy = {
      requirements: valid.requirements.map((r) => ({
        ...r,
        evidence: '  line one\n\n line two ' + 'x'.repeat(400),
      })),
      explanation: '  Good   fit. ',
    };
    const result = parseScreeningResult(reply(messy), requirements);
    expect(result.explanation).toBe('Good fit.');
    expect(result.requirement_matches[0].evidence).toMatch(
      /^line one line two x/,
    );
    expect(result.requirement_matches[0].evidence).toHaveLength(300);
  });

  it.each([
    ['not JSON', 'Sure! The candidate is great.'],
    ['no requirements list', reply({ explanation: 'ok' })],
    [
      'too few requirements',
      reply({ ...valid, requirements: valid.requirements.slice(0, 2) }),
    ],
    [
      'an unknown match value',
      reply({
        ...valid,
        requirements: [
          { ...valid.requirements[0], match: 'yes' },
          ...valid.requirements.slice(1),
        ],
      }),
    ],
    [
      'a repeated number',
      reply({
        ...valid,
        requirements: [
          valid.requirements[0],
          valid.requirements[0],
          valid.requirements[2],
        ],
      }),
    ],
    [
      'a number out of range',
      reply({
        ...valid,
        requirements: [
          { ...valid.requirements[0], number: 4 },
          ...valid.requirements.slice(1),
        ],
      }),
    ],
    ['no explanation', reply({ ...valid, explanation: '   ' })],
  ])('rejects %s', (_, text) => {
    expect(() => parseScreeningResult(text, requirements)).toThrow(
      InvalidScreeningResponseError,
    );
  });
});
