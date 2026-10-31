# TalentFlow

AI-powered applicant screening and pipeline system by **Trader Joe's** for COMP019.

Recruiters post jobs, applicants apply through an online form, an AI service scores each resume against the posting, and the hiring team moves candidates through a shared pipeline (Applied → Screening → Interview → Offer / Rejected).

## Live links

| | URL |
|---|---|
| Web app | https://talentflow.appwrite.network |
| API | https://talentflow-api-0j7m.onrender.com (status: [`/api/health`](https://talentflow-api-0j7m.onrender.com/api/health)) |
| API docs | https://talentflow-api-0j7m.onrender.com/api/docs |

> The API runs on Render's free tier and sleeps after 15 minutes without traffic. The first request after that can take up to a minute.

## Sample accounts

| Role | Email | Password |
|---|---|---|
| Recruitment Manager | `manager@talentflow.dev` | `Manager123!` |
| Recruiter | `recruiter@talentflow.dev` | `Recruiter123!` |
| Applicant | `applicant@talentflow.dev` | `Applicant123!` |

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
| POST | `/auth/register-applicant` | Public | – |
| GET | `/auth/me` | Signed in | – |
| GET | `/health` | Public | – |

Errors always look like `{ "error": "message", "details": ["..."] }`.

## Deployment setup (for reference)

1. **Database (Neon):** Singapore region. The connection string is stored only in Render's environment variables.
2. **API (Render):** web service from the `dev` branch.
   - Root directory: `backend/`
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start:prod` (runs migrations, then starts the API)
   - Health check path: `/api/health`
   - Environment: `NODE_VERSION=24`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN=1d`, `CORS_ORIGINS`
   - Auto-deploy is off; GitHub Actions triggers deploys with the `RENDER_DEPLOY_HOOK` secret.
3. **Web app (Appwrite Sites):** site connected to the `dev` branch.
   - Root directory: `frontend`
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `./dist/frontend/browser`
   - Fallback file: `index.html` (needed so refreshing `/dashboard` works)

## How we work (GitHub Flow)

```
feature branch ──PR──▶ dev ──PR at end of sprint──▶ main
```

- `dev` is where finished work is combined. `main` holds each sprint's release.
- Never push directly to `dev` or `main`. Both are protected: each PR needs 1 approval and passing CI.
- Start every branch from an up-to-date `dev`:
  ```bash
  git checkout dev
  git pull
  git checkout -b feat-job-postings-crud
  ```
- Branch names: `feat-…`, `fix-…`, `docs-…`, `chore-…`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat(frontend): add careers page`.
- Open pull requests into `dev`. At the end of each sprint, the PM opens a `dev → main` release PR.
- Sprint documents go in `documents/sprint-N/`.

## 📐 Angular Coding Guidelines & Best Practices

This repository adheres to strict coding standards to maintain readability, security, and predictability across the codebase. Please review and follow these guidelines when writing code or submitting pull requests:

### 1. Project Setup & Static Assets
- **Git Ignore:** Always configure your `.gitignore` to exclude the `node_modules` directory.
- **Static Files:** Place static assets (images, videos, etc.) in `public/assets/` or directly inside the `public/` folder.

### 2. TypeScript Standards & Naming Conventions
- **Naming Cases:**
  - Use **PascalCase** for type aliases, classes, decorator functions, and enums.
  - Use **capitalized snake_case** for enum elements (e.g., `USER_ROLE`).
  - Variable and function names must be descriptive and reflect what they hold or do.
  - Boolean variables and functions should have yes/no answerable names (e.g., `isValid`, `hasProperty`, `isOnline()`).
- **Types & Variables:**
  - Never use the `any` or `Object` types.
  - Always specify types for every function parameter.
  - Use the `type` keyword (instead of `interface`) to structure objects.
  - Use `enum` to group related constants.
  - Leverage TypeScript's type inference: primitive variables initialized with a value do not require explicit types, but empty arrays or custom objects initialized with values must specify their types (e.g., `students: Student[] = []`).

### 3. Modern Angular Over Vanilla JS
- Avoid using Vanilla JS approaches (such as `querySelector`, `addEventListener`, or manual `async/await`) where native Angular and RxJS idioms apply.

### 4. Components, Templates, Forms, & Styling
- **Control Flow:** Use Angular's built-in control flow syntax (`@if`, `@for`) instead of legacy structural directives (`*ngIf`, `*ngFor`).
- **Imports:** Enclose all components in open and close brackets in your import statements.
- **Forms:** Always use **Reactive Forms** and form builders. Use the object form when creating form validators and explicitly specify return types for custom validator functions (`null` or `{ [errorKey]: string }`).
- **Styling:**
  - Never use `ngStyle`; keep all styles in CSS/SCSS files and use the `ngClass` directive instead.
  - When using the `::ng-deep` pseudo-class, always encapsulate it within a parent container like `:host`:
    ```scss
    :host {
      ::ng-deep p {
        background-color: red;
      }
    }
    ```
  - Keep CSS/SCSS nesting to a maximum of 3 levels.

### 5. Services & HTTP Architecture
- **Services for APIs:** Always create a dedicated service to implement HTTP requests. **Never** use `HttpClient` directly inside components.
- **Response Models:** Always create a model or interface/type to structure HTTP responses (avoid using `Object` or `any`).

### 6. RxJS & Observable Best Practices
- **No Nested Subscriptions:** Do not create an inner observable inside a subscription.
- **Use Operators:** Use `.pipe()` and appropriate RxJS operators to chain operations cleanly instead of nesting subscriptions manually.

### 7. Code Quality, Formatting, & Comments
- **Line Length:** Keep each line at a maximum of 80 columns.
- **Constants:** Avoid magic values by defining constant values or using centralized constants files.
- **Spacing:** Maintain proper spacing. Leave a maximum of 1 extra newline for readability.
- **Clean Code:** Regularly remove dead code, unused HTML elements, and unused files.
- **TODO Comments:** Use the strict TODO format for pending tasks:
  - HTML: `<!-- TODO(Lastname, Givenname): What needs to be done -->`
  - TS/JS: `// TODO(Lastname, Givenname): What needs to be done`

### 8. Version Control & Pull Requests
- Follow standard Git branching strategies and never push directly to `main`.
- Ensure all pull requests undergo code review and receive at least **1 approval** before merging.
### Deployments

| Part | Host | Deploys when |
|---|---|---|
| Web app | Appwrite Sites | A change is merged into `dev` |
| API | Render | A change is merged into `dev` and the CI **Backend** job passes |
| Database | Neon | Migrations run automatically on each API deploy |
