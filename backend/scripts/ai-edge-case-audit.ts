/**
 * AI scoring audit with edge-case resumes (Sprint 5 QA task): runs 11
 * deliberately awkward resumes through the real extraction step
 * (extractResumeText) and the real prompt/schema/parser the app uses, and
 * reports expected vs actual score, whether extraction behaved as expected,
 * and any retries/errors. Meant to surface prompt or parsing issues for Pat,
 * not to re-check Gemini's reliability (see ai-proof-of-concept.ts for that).
 *
 * Needs GEMINI_API_KEY in backend/.env. Two cases never reach Gemini (they
 * fail extraction on purpose), so this uses at most 9 of the free tier's 20
 * requests/day per model. Run it at most once a day and not on a day the app
 * needs the quota.
 * Run with: npm run ai:edge-audit
 */
import 'dotenv/config';
import { DEFAULT_GEMINI_MODEL } from '../src/ai-screenings/gemini.client.js';
import {
  buildScreeningPrompt,
  MAX_RESUME_CHARS,
  SCREENING_RESPONSE_SCHEMA,
  SCREENING_SYSTEM_PROMPT,
  splitRequirements,
} from '../src/ai-screenings/screening-prompt.js';
import { parseScreeningResult } from '../src/ai-screenings/screening-result.js';
import { extractResumeText, ResumeTextError } from '../src/resumes/resume-text.js';
import { buildEmptyPdf, buildPdf } from '../test/resume-files.js';

const PAUSE_MS = 15_000;
const RETRY_WAITS_MS = [20_000, 40_000, 60_000];

/** Y = met, P = partial, N = missing. */
const MATCH_CODES = { met: 'Y', partial: 'P', missing: 'N' } as const;

const posting = {
  title: 'Junior Web Developer',
  description:
    'Build and maintain internal web applications with the product team.',
  requirements: [
    "Bachelor's degree in IT, Computer Science, or a related field",
    'At least 1 year of experience with JavaScript or TypeScript',
    'Experience with Angular or React',
    'Working knowledge of SQL databases',
    'Uses Git for version control',
  ].join('\n'),
};

const strong = [
  'Maria Santos, Web Developer, Cavite',
  'EDUCATION: BS Information Technology, De La Salle University-Dasmarinas, 2023.',
  'EXPERIENCE: Junior Developer, Acme Solutions (June 2023 - present).',
  '- Built an Angular 17 + TypeScript dashboard for 300 internal users.',
  '- Wrote PostgreSQL queries and stored procedures for reporting.',
  '- Daily Git workflow: feature branches, pull requests, code review on GitHub.',
  'SKILLS: TypeScript, JavaScript, Angular, RxJS, PostgreSQL, Git.',
];

/**
 * A deliberately malformed file: real "%PDF-" bytes (so the upload's magic
 * byte check accepts it, like resumes.service.upload would), then garbage
 * with no xref table or objects, so the PDF parser itself fails.
 */
const corruptedPdf = Buffer.from(
  '%PDF-1.4\n%\xff\xff garbage, no objects, no xref, no trailer\x00\x01\x02',
  'latin1',
);

type Case = {
  name: string;
  category: string;
  file: Buffer;
  /** Whether extractResumeText should succeed on this file. */
  expectExtractionOk: boolean;
  /** Only meaningful when expectExtractionOk is true. */
  expectScoreRange?: [number, number];
  note: string;
};

const cases: Case[] = [
  {
    name: 'Scanned / image-only PDF',
    category: 'extraction',
    file: buildEmptyPdf(),
    expectExtractionOk: false,
    note: 'A page with no text layer, like an unocred scan. Should fail cleanly as "no readable text", not crash or silently score 0.',
  },
  {
    name: 'Corrupted file',
    category: 'extraction',
    file: corruptedPdf,
    expectExtractionOk: false,
    note: 'Passes the upload\'s "%PDF-" magic byte check but the parser should fail on the body. Check whether the error message wrongly calls this a "scanned image" when it is actually just broken.',
  },
  {
    name: 'Very short resume (one line)',
    category: 'content',
    file: buildPdf(['Juan Dela Cruz. Contact: juan@example.com']),
    expectExtractionOk: true,
    expectScoreRange: [0, 0],
    note: 'No skills or experience at all. Should score 0 with every requirement "missing", not hallucinate a match.',
  },
  {
    name: 'Very long resume (past the character cutoff)',
    category: 'content',
    file: buildPdf([
      ...strong,
      '',
      'PROJECT LOG',
      ...Array.from(
        { length: 1200 },
        (_, i) =>
          `Week ${i + 1}: maintained internal tools, attended stand-ups, updated documentation.`,
      ),
    ]),
    expectExtractionOk: true,
    expectScoreRange: [90, 100],
    note: `Qualifying content comes first, so it survives the ${MAX_RESUME_CHARS.toLocaleString()}-char cutoff in buildScreeningPrompt. Should still score like "strong". If this were reversed (quals near the end), the cutoff would silently drop them — worth a follow-up case if that's a realistic resume shape.`,
  },
  {
    name: 'Taglish resume',
    category: 'content',
    file: buildPdf([
      'Anna Dela Cruz, Full Stack Developer, Cavite',
      'EDUKASYON: BS Information Technology, PUP Manila, 2022.',
      'KARANASAN: Frontend Developer sa Kalye Tech (2022-present).',
      '- Gumawa ng e-commerce site gamit ang React at TypeScript para sa 5,000 users kada araw.',
      '- Nag-maintain ng PostgreSQL database at gumagamit ng Git araw-araw para sa version control.',
      'KASANAYAN: JavaScript, TypeScript, React, Node.js, PostgreSQL, Git.',
    ]),
    expectExtractionOk: true,
    expectScoreRange: [80, 100],
    note: 'Genuinely qualifying content, just mixed Filipino/English. Should not be scored lower for the language it is written in.',
  },
  {
    name: 'Fully non-English resume (Tagalog)',
    category: 'content',
    file: buildPdf([
      'Pedro Ramos, Web Developer, Cavite',
      'EDUKASYON: BS Information Technology, Cavite State University, 2023.',
      'KARANASAN: Web Developer, Bayan Tech (2023-kasalukuyan).',
      '- Gumawa ng mga web application gamit ang Angular at TypeScript para sa 200 gumagamit.',
      '- Sumulat ng mga SQL query para sa mga ulat ng kumpanya.',
      '- Araw-araw na gumagamit ng Git para sa pamamahala ng source code.',
      'KASANAYAN: JavaScript, TypeScript, Angular, SQL, Git.',
    ]),
    expectExtractionOk: true,
    expectScoreRange: [80, 100],
    note: 'Same qualifying content as the strong case, zero English. If the score drops noticeably from the Taglish or English version, that is a language bias to flag.',
  },
  {
    name: 'Two-column layout (columns extracted out of order)',
    category: 'formatting',
    file: buildPdf([
      'Jane Reyes Experience:',
      'Education: Frontend Developer, ABC Corp (2022-present)',
      'BS Computer Science, 2022 React, TypeScript, REST APIs',
      'Skills: PUP Manila, built a 10k-user dashboard',
      'React, TypeScript, SQL, Git Used Git daily for version control',
    ]),
    expectExtractionOk: true,
    expectScoreRange: [50, 100],
    note: 'Simulates what a naive two-column text extractor often produces: lines from both columns interleaved. All the real signal is still present, just jumbled — see how much the score suffers versus the same content laid out normally.',
  },
  {
    name: 'Table layout (cells extracted row-then-row instead of by record)',
    category: 'formatting',
    file: buildPdf([
      'Name Role Company Years',
      'Pedro Cruz Backend Developer',
      'XYZ Technologies 2021-2024',
      'Skills:',
      'Node.js PostgreSQL Docker Git',
    ]),
    expectExtractionOk: true,
    expectScoreRange: [30, 90],
    note: 'Simulates a table dumped as "all labels, then all values" instead of by row. Real requirements (SQL via PostgreSQL, Git) are present but disconnected from context — check whether evidence quotes in the response still make sense given how garbled the input is.',
  },
  {
    name: 'Wrong role for the posting',
    category: 'content',
    file: buildPdf([
      'Carla Mendoza, Registered Nurse',
      'EDUCATION: BS Nursing, University of Santo Tomas, 2019.',
      'EXPERIENCE: Staff Nurse, Makati Medical Center (2019-present).',
      '- Managed patient charts and administered medication for a 30-bed ward.',
      '- Trained incoming nurses on hospital protocol.',
      'SKILLS: Patient care, charting, IV therapy, BLS certified.',
    ]),
    expectExtractionOk: true,
    expectScoreRange: [0, 10],
    note: 'Strong resume, but for a completely unrelated profession. Score should be very low, and the explanation should say the experience doesn\'t match — not invent a connection.',
  },
  {
    name: 'Keyword-stuffed resume (no real evidence)',
    category: 'content',
    file: buildPdf([
      'Mark Villanueva',
      "Bachelor's degree in IT, Computer Science, related field.",
      'JavaScript TypeScript Angular React SQL Git JavaScript TypeScript Angular React SQL Git',
      'Experienced in JavaScript, TypeScript, Angular, React, SQL, and Git.',
      'Skilled in JavaScript, TypeScript, Angular, React, SQL, and Git.',
    ]),
    expectExtractionOk: true,
    expectScoreRange: [0, 30],
    note: 'Every requirement keyword appears, repeatedly, with zero job history, dates, or context. The system prompt says to require the resume to "show" each skill, not just name it — if this scores high, that\'s a real gaming vulnerability for Pat to tighten in the prompt.',
  },
  {
    name: 'Resume with no contact info',
    category: 'content',
    file: buildPdf([
      'Full Stack Developer',
      'EDUCATION: BS Information Technology, De La Salle University-Dasmarinas, 2023.',
      'EXPERIENCE: Junior Developer, Acme Solutions (2023-present).',
      '- Built an Angular + TypeScript dashboard for internal use.',
      '- Wrote PostgreSQL queries for reporting; uses Git daily.',
      'SKILLS: TypeScript, JavaScript, Angular, PostgreSQL, Git.',
    ]),
    expectExtractionOk: true,
    expectScoreRange: [80, 100],
    note: 'No name, email, or phone anywhere in the resume body (the applicant\'s contact info lives in the application form, not the CV). Score should be identical to an equivalent resume that does have contact info — fit scoring should only care about skills and experience.',
  },
];

type Run = {
  extracted: boolean;
  extractionError?: string;
  score?: number;
  matches?: string;
  explanation?: string;
  retries: number;
  geminiError?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
const requirements = splitRequirements(posting.requirements);

/** Same request the app sends (see gemini.client.ts). */
async function callGemini(prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY ?? '',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SCREENING_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: SCREENING_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('');
  return { status: res.status, text };
}

async function scoreOnce(resumeText: string): Promise<Omit<Run, 'extracted'>> {
  const prompt = buildScreeningPrompt(posting, resumeText);
  for (let retries = 0; ; retries++) {
    let reply: Awaited<ReturnType<typeof callGemini>>;
    try {
      reply = await callGemini(prompt);
    } catch (err) {
      if (retries >= RETRY_WAITS_MS.length) {
        return { retries, geminiError: String(err) };
      }
      await sleep(RETRY_WAITS_MS[retries]);
      continue;
    }
    const busy =
      reply.status === 429 || reply.status >= 500;
    if (busy && retries < RETRY_WAITS_MS.length) {
      await sleep(RETRY_WAITS_MS[retries]);
      continue;
    }
    if (reply.status !== 200 || !reply.text) {
      return { retries, geminiError: `HTTP ${reply.status}` };
    }
    try {
      const result = parseScreeningResult(reply.text, requirements);
      return {
        retries,
        score: result.fit_score,
        matches: result.requirement_matches
          .map((m) => MATCH_CODES[m.match])
          .join(''),
        explanation: result.explanation,
      };
    } catch (err) {
      return { retries, geminiError: String(err) };
    }
  }
}

async function runCase(c: Case): Promise<Run> {
  let resumeText: string;
  try {
    resumeText = await extractResumeText(c.file);
  } catch (err) {
    const message = err instanceof ResumeTextError ? err.message : String(err);
    return { extracted: false, extractionError: message, retries: 0 };
  }
  const scored = await scoreOnce(resumeText);
  return { extracted: true, ...scored };
}

const results: { case: Case; run: Run }[] = [];
console.log(`Model: ${model}, ${cases.length} edge cases\n`);
for (const c of cases) {
  const run = await runCase(c);
  results.push({ case: c, run });
  if (!run.extracted) {
    console.log(`${c.name}: extraction failed - ${run.extractionError}`);
  } else if (run.geminiError) {
    console.log(`${c.name}: FAILED - ${run.geminiError} (${run.retries} retries)`);
  } else {
    console.log(
      `${c.name}: score ${run.score} [${run.matches}]` +
        (run.retries ? `, ${run.retries} retries` : ''),
    );
  }
  if (run.extracted && !run.geminiError) await sleep(PAUSE_MS);
}

console.log(
  '\n| Case | Category | Expected | Actual | As expected? | Notes for Pat |',
);
console.log('| :--- | :--- | :--- | :--- | :--- | :--- |');
for (const { case: c, run } of results) {
  const expected = c.expectExtractionOk
    ? `score ${c.expectScoreRange![0]}-${c.expectScoreRange![1]}`
    : 'extraction should fail';

  let actual: string;
  let asExpected: string;
  if (!run.extracted) {
    actual = `extraction failed: ${run.extractionError}`;
    asExpected = c.expectExtractionOk ? 'No' : 'Yes';
  } else if (run.geminiError) {
    actual = `Gemini/parse error: ${run.geminiError}`;
    asExpected = 'No';
  } else {
    actual = `score ${run.score} [${run.matches}]`;
    asExpected =
      c.expectExtractionOk && run.score !== undefined
        ? run.score >= c.expectScoreRange![0] && run.score <= c.expectScoreRange![1]
          ? 'Yes'
          : 'No'
        : 'No';
  }
  console.log(
    `| ${c.name} | ${c.category} | ${expected} | ${actual} | ${asExpected} | ${c.note} |`,
  );
}

console.log('\nFull explanations (read these for "do the reasons make sense"):');
for (const { case: c, run } of results) {
  if (run.explanation) console.log(`\n${c.name}:\n  ${run.explanation}`);
}

const flagged = results.filter(
  ({ case: c, run }) =>
    (!run.extracted && !c.expectExtractionOk) ||
    (run.extracted && c.expectExtractionOk && !run.geminiError &&
      run.score !== undefined &&
      (run.score < c.expectScoreRange![0] || run.score > c.expectScoreRange![1])) ||
    (run.extracted && run.geminiError),
);
console.log(
  `\n${flagged.length}/${cases.length} cases came out outside expectations - these are the ones to log for Pat:`,
);
for (const { case: c } of flagged) console.log(`- ${c.name}`);
