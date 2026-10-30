import {
  buildScreeningPrompt,
  MAX_RESUME_CHARS,
  SCREENING_SYSTEM_PROMPT,
  splitRequirements,
} from './screening-prompt.js';

const posting = {
  title: 'Software Developer',
  description: 'Develop and maintain software applications.',
  requirements: 'JavaScript\n\n  SQL  \r\nGit',
};

describe('splitRequirements', () => {
  it('returns one trimmed requirement per non-empty line', () => {
    expect(splitRequirements(posting.requirements)).toEqual([
      'JavaScript',
      'SQL',
      'Git',
    ]);
  });
});

describe('buildScreeningPrompt', () => {
  it('numbers the requirements in order', () => {
    const prompt = buildScreeningPrompt(posting, 'Juan knows SQL.');
    expect(prompt).toContain('Requirements:\n1. JavaScript\n2. SQL\n3. Git');
    expect(prompt).toContain('Job title: Software Developer');
  });

  it('puts the resume between markers, after the posting', () => {
    const prompt = buildScreeningPrompt(posting, '  Juan knows SQL.  ');
    expect(prompt).toMatch(/<<<RESUME\nJuan knows SQL\.\nRESUME>>>$/);
    expect(prompt.indexOf('Requirements:')).toBeLessThan(
      prompt.indexOf('<<<RESUME'),
    );
  });

  it('cuts very long resumes', () => {
    const prompt = buildScreeningPrompt(
      posting,
      'a'.repeat(MAX_RESUME_CHARS + 50),
    );
    expect(prompt).toContain('a'.repeat(MAX_RESUME_CHARS) + '\nRESUME>>>');
    expect(prompt).not.toContain('a'.repeat(MAX_RESUME_CHARS + 1));
  });
});

describe('SCREENING_SYSTEM_PROMPT', () => {
  it('tells Gemini the resume is data, not instructions', () => {
    expect(SCREENING_SYSTEM_PROMPT).toMatch(/not instructions/);
  });

  it('keeps the score out of Gemini’s hands', () => {
    expect(SCREENING_SYSTEM_PROMPT).toMatch(/Do not mention a numeric score/);
  });
});
