# TalentFlow

AI-powered applicant screening and pipeline system by **Trader Joe's** for COMP019.

Recruiters post jobs, applicants apply through an online form, an AI service scores each resume against the posting, and the hiring team moves candidates through a shared pipeline (Applied → Screening → Interview → Offer / Rejected).

## Live links

| | URL |
|---|---|
| Web app | _add the Appwrite Sites URL here_ |
| API | _add the Render URL here_ (`/api/health` shows status) |
| API docs | _Render URL_ + `/api/docs` |

## Sample accounts

| Role | Email | Password |
|---|---|---|
| Recruitment Manager | `manager@talentflow.dev` | `Manager123!` |
| Recruiter | `recruiter@talentflow.dev` | `Recruiter123!` |

These are created automatically the first time the API starts on an empty database.

## Team

| Member | Role |
|---|---|
| Allyson Aiven A. Martin | Project Manager / Developer |
| Patrick James S. Lauron | Technical Lead / Developer |
| Paula Mitchel O. Ng | UI/UX Designer / Developer |
| Nicko Albert B. Dela Cruz | Tester / Developer |
| Alarie S. Somuelo | Tester / Developer |

## Tech stack

| Layer | Tools | Hosted on |
|---|---|---|
| Frontend | Angular 22 (standalone components, signals), SCSS | Appwrite Sites |
| Backend | NestJS 12 REST API, JWT auth, role guards | Render |
| Database | PostgreSQL with Drizzle ORM | Neon |
| Testing | Vitest (both apps), Supertest (API e2e) | GitHub Actions |

## Project structure

```
project-trader-joes/
├── backend/              NestJS API
│   ├── drizzle/          SQL migrations (generated, commit these)
│   └── src/
│       ├── auth/         login, register, current user
│       ├── common/       guards, decorators, error filter
│       ├── database/     schema, migrations runner, seed
│       ├── health/       /api/health
│       └── users/
├── frontend/             Angular app
│   └── src/app/
│       ├── core/         auth service, interceptor, guards, API helpers
│       ├── layout/       signed-in shell (top bar + navigation)
│       └── pages/        login, dashboard, team
├── documents/            proposal, WBS, timeline, sprint documents
├── .github/              CI workflow and PR template
└── render.yaml           backend deployment config
```

## Getting started

**Requirements:** Node.js 24 (or 22.22.3+), and PostgreSQL 16+ installed locally or a free [Neon](https://neon.tech) database.

```bash
# 1. Install everything
npm run setup

# 2. Configure the backend
cp backend/.env.example backend/.env
#    then set DATABASE_URL and JWT_SECRET in backend/.env

# 3. Create the tables and sample accounts
npm run db:migrate --prefix backend

# 4. Start the API (localhost:3000) and the web app (localhost:4200)
npm run dev
```

Open http://localhost:4200 and sign in with a sample account. API docs are at http://localhost:3000/api/docs.

## Common scripts

| Where | Command | What it does |
|---|---|---|
| root | `npm run dev` | Starts the API and web app together |
| root | `npm test` | Runs both test suites |
| backend | `npm run db:generate` | Creates a migration after you change `src/database/schema.ts` |
| backend | `npm run db:migrate` | Applies migrations and seeds sample accounts if empty |
| backend | `npm run db:studio` | Opens a browser view of the database |
| backend | `npm run test:e2e` | API tests against the database in `.env` |

## API (Sprint 1)

All routes start with `/api`. Send the token from login as `Authorization: Bearer <token>`.

| Method | Route | Access | Spec |
|---|---|---|---|
| POST | `/auth/login` | Public | I.A |
| POST | `/auth/register` | Manager | I.B |
| GET | `/auth/me` | Signed in | – |
| GET | `/health` | Public | – |

Errors always look like `{ "error": "message", "details": ["..."] }`.

## Deployment

1. **Database (Neon):** create a project and copy the connection string.
2. **API (Render):** New → Blueprint → select this repo. Set `DATABASE_URL` to the Neon string and `CORS_ORIGINS` to the web app URL. Each deploy runs migrations before starting.
3. **Web app (Appwrite Sites):** Create site → connect this repo with these settings:
   - Root directory: `frontend`
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `./dist/frontend/browser`
   - Fallback file: `index.html` (needed so page refreshes on `/dashboard` work)
4. Put the Render URL in `frontend/src/environments/environment.ts`, and both URLs in the **Live links** table above.

> Render's free tier sleeps after 15 minutes without traffic. The first request after that takes about a minute.

## How we work (GitHub Flow)

- Never push to `main`. Create a branch from `main`, then open a pull request.
- Branch names: `feat-…`, `fix-…`, `docs-…`, `chore-…` (e.g. `feat-job-postings-crud`).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat(frontend): add careers page`.
- `main` is protected: each PR needs 1 approval and a passing CI check.
- Sprint documents go in `documents/sprint-N/`.
