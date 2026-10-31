import {
  AiScreening,
  RequirementMatch,
  RequirementMatchLevel,
  ScreeningStatus,
} from '../../core/ai-screenings';

/**
 * Sample applicants for the Applications page. The API has no
 * GET /api/applications yet (Sprint 4: WBS 4.4); once it does, load the
 * list from there and delete this file.
 */

export type KanbanStage =
  'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected';

export type ApplicationRow = {
  id: number;
  full_name: string;
  email: string;
  posting_title: string;
  kanban_stage: KanbanStage;
  submitted_at: string;
  screening: AiScreening | null;
  /** What a sample "Score resume" or "Retry" returns. Sample data only. */
  sample_result?: AiScreening;
};

const FRONTEND = 'Frontend Developer Intern';
const QA = 'QA Analyst';

const { MET, PARTIAL, MISSING } = RequirementMatchLevel;

const m = (
  requirement: string,
  match: RequirementMatchLevel,
  evidence: string,
): RequirementMatch => ({ requirement, match, evidence });

function screening(
  application_id: number,
  fit_score: number,
  explanation: string,
  requirement_matches: RequirementMatch[],
): AiScreening {
  return {
    id: application_id,
    application_id,
    fit_score,
    explanation,
    requirement_matches,
    status: ScreeningStatus.COMPLETED,
    failure_reason: null,
    retry_count: 0,
    screened_at: '2026-10-30T09:20:00Z',
  };
}

function failed(application_id: number): AiScreening {
  return {
    id: application_id,
    application_id,
    fit_score: null,
    explanation: null,
    requirement_matches: null,
    status: ScreeningStatus.FAILED,
    failure_reason: 'The AI service took too long to answer. Try again.',
    retry_count: 0,
    screened_at: '2026-10-30T09:24:00Z',
  };
}

export const SAMPLE_APPLICATIONS: ApplicationRow[] = [
  {
    id: 101,
    full_name: 'Mei-Lin Chen',
    email: 'meilin.chen@example.com',
    posting_title: FRONTEND,
    kanban_stage: 'Screening',
    submitted_at: '2026-10-21T02:10:00Z',
    screening: screening(
      101,
      90,
      'Two frontend internships with production Angular and TypeScript work, plus a well-documented capstone. Testing experience is light but present.',
      [
        m(
          'Angular or React in a real project',
          MET,
          'Built the student portal at Acme Labs in Angular 20.',
        ),
        m(
          'TypeScript',
          MET,
          'TypeScript across both internships and the capstone.',
        ),
        m(
          'Git and pull requests',
          MET,
          'Reviewed and merged PRs as part of a four-person team.',
        ),
        m(
          'Responsive CSS',
          MET,
          'Mobile-first SCSS for the capstone dashboard.',
        ),
        m(
          'Unit testing',
          PARTIAL,
          'Wrote a few Jest tests for form validation.',
        ),
      ],
    ),
  },
  {
    id: 102,
    full_name: 'Jonah Reyes',
    email: 'jonah.reyes@example.com',
    posting_title: FRONTEND,
    kanban_stage: 'Applied',
    submitted_at: '2026-10-21T05:42:00Z',
    screening: screening(
      102,
      90,
      'Strong React and TypeScript background from freelance work and a hackathon win. Git use is solid; responsive work is shown but not described in depth.',
      [
        m(
          'Angular or React in a real project',
          MET,
          'Freelance React storefront for a local bakery.',
        ),
        m(
          'TypeScript',
          MET,
          'Rewrote the storefront from JavaScript to TypeScript.',
        ),
        m(
          'Git and pull requests',
          MET,
          'Maintains two open-source repos with outside contributors.',
        ),
        m('Responsive CSS', PARTIAL, 'Mentions mobile layouts without detail.'),
        m(
          'Unit testing',
          MET,
          'Vitest suite with 80% coverage on the storefront.',
        ),
      ],
    ),
  },
  {
    id: 103,
    full_name: 'Aisha Rahman',
    email: 'aisha.rahman@example.com',
    posting_title: FRONTEND,
    kanban_stage: 'Interview',
    submitted_at: '2026-10-20T08:15:00Z',
    screening: screening(
      103,
      70,
      'Good TypeScript and Git habits from a backend-leaning internship. Frontend work is mostly coursework, and no testing is shown.',
      [
        m(
          'Angular or React in a real project',
          PARTIAL,
          'React only in a class project.',
        ),
        m('TypeScript', MET, 'Node and TypeScript APIs during internship.'),
        m(
          'Git and pull requests',
          MET,
          'Used GitHub flow with code review at work.',
        ),
        m('Responsive CSS', MET, 'Built a responsive portfolio site.'),
        m('Unit testing', MISSING, 'No testing tools or test work listed.'),
      ],
    ),
  },
  {
    id: 104,
    full_name: 'Lucas Martin',
    email: 'lucas.martin@example.com',
    posting_title: FRONTEND,
    kanban_stage: 'Applied',
    submitted_at: '2026-10-22T01:05:00Z',
    screening: failed(104),
    sample_result: screening(
      104,
      60,
      'Comfortable with React and CSS from personal projects. TypeScript and Git are only lightly shown, and there is no testing experience.',
      [
        m(
          'Angular or React in a real project',
          MET,
          'Personal React budgeting app, deployed on Vercel.',
        ),
        m('TypeScript', PARTIAL, 'Lists TypeScript under skills only.'),
        m(
          'Git and pull requests',
          PARTIAL,
          'GitHub profile linked; no team work described.',
        ),
        m(
          'Responsive CSS',
          MET,
          'Hand-built responsive layouts with CSS grid.',
        ),
        m('Unit testing', MISSING, 'No testing tools or test work listed.'),
      ],
    ),
  },
  {
    id: 105,
    full_name: 'Hana Kim',
    email: 'hana.kim@example.com',
    posting_title: FRONTEND,
    kanban_stage: 'Applied',
    submitted_at: '2026-10-31T03:30:00Z',
    screening: null,
    sample_result: screening(
      105,
      40,
      'Design-focused profile with strong CSS and some React. Little evidence of TypeScript, Git workflow, or code testing.',
      [
        m(
          'Angular or React in a real project',
          PARTIAL,
          'React prototypes for a design class.',
        ),
        m('TypeScript', MISSING, 'Not mentioned.'),
        m(
          'Git and pull requests',
          PARTIAL,
          'Shared Figma and code files over GitHub.',
        ),
        m(
          'Responsive CSS',
          MET,
          'Responsive landing pages for two student orgs.',
        ),
        m(
          'Unit testing',
          MISSING,
          'Lists usability testing only, not code tests.',
        ),
      ],
    ),
  },
  {
    id: 106,
    full_name: 'Kenji Watanabe',
    email: 'kenji.w@example.com',
    posting_title: QA,
    kanban_stage: 'Screening',
    submitted_at: '2026-10-19T06:50:00Z',
    screening: screening(
      106,
      63,
      'Manual testing experience from an OJT and some automation in coursework. No CI work shown.',
      [
        m(
          'Manual test cases and bug reports',
          MET,
          'Wrote 120+ test cases during OJT at a fintech startup.',
        ),
        m(
          'Test automation (Playwright or Cypress)',
          PARTIAL,
          'Cypress in a class project only.',
        ),
        m(
          'SQL for checking data',
          MET,
          'Used SQL to verify transaction records.',
        ),
        m('CI pipelines', MISSING, 'Not mentioned.'),
      ],
    ),
  },
  {
    id: 107,
    full_name: 'Sofia Alvarez',
    email: 'sofia.alvarez@example.com',
    posting_title: QA,
    kanban_stage: 'Screening',
    submitted_at: '2026-10-18T10:00:00Z',
    screening: screening(
      107,
      50,
      'Detail-oriented with documentation experience. Testing work is limited to peer review, and automation is not shown.',
      [
        m(
          'Manual test cases and bug reports',
          MET,
          'Ran QA for a student org app before launch.',
        ),
        m('Test automation (Playwright or Cypress)', MISSING, 'Not mentioned.'),
        m('SQL for checking data', PARTIAL, 'Database course; no applied use.'),
        m('CI pipelines', PARTIAL, 'Set up GitHub Actions for a class repo.'),
      ],
    ),
  },
  {
    id: 108,
    full_name: 'Daniel Okafor',
    email: 'daniel.okafor@example.com',
    posting_title: QA,
    kanban_stage: 'Rejected',
    submitted_at: '2026-10-17T04:20:00Z',
    screening: screening(
      108,
      25,
      'Resume focuses on sales and customer support. Some attention to detail is shown, but none of the testing requirements are clearly met.',
      [
        m(
          'Manual test cases and bug reports',
          PARTIAL,
          'Logged customer-reported issues in a ticket system.',
        ),
        m('Test automation (Playwright or Cypress)', MISSING, 'Not mentioned.'),
        m('SQL for checking data', PARTIAL, 'Basic Excel reporting; no SQL.'),
        m('CI pipelines', MISSING, 'Not mentioned.'),
      ],
    ),
  },
];
