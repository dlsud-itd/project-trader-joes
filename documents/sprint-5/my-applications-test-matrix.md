# My Applications Test Matrix - Sprint 5

Covers the "Applicant portal: My Applications status page" task (branch `feat-my-applications`):

- `GET /api/applications/mine` returns a signed-in applicant's own applications (matched on the
  application email, ignoring letter case) with the posting title, date, and an applicant-friendly
  status. No AI scores, ratings, or notes.
- `/careers/applications` lists them with a status badge, and is linked from the careers header and
  the Apply thank-you screen.

`TC-MYAPP-01` to `05` are covered by `backend/test/applications.e2e-spec.ts`
(`npm run test:e2e --prefix backend`). `TC-MYAPP-06` to `09` are covered by
`frontend/src/app/pages/my-applications/my-applications.spec.ts`, `10` and `11` by
`frontend/src/app/core/auth/auth.guards.spec.ts`, `12` by
`frontend/src/app/layout/public-shell.spec.ts`, and `13` and `14` by
`frontend/src/app/pages/apply/apply.spec.ts`. The service call is covered by
`frontend/src/app/core/applications/applications.service.spec.ts`. Results below are from the
automated run on 2026-11-21 (frontend 287/287, backend 156/156, applications e2e 20/20) and a
check by hand in the browser the same day against the local API and web app.

## 1. API (`GET /api/applications/mine`)

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-MYAPP-01 | Only applicant-safe fields are returned | 1. Apply with the applicant's email; the application has an AI screening<br>2. As that applicant, GET `/api/applications/mine` | Each item has exactly `id`, `job_posting_id`, `posting_title`, `submitted_at`, `status`; no screening, rating, or note fields | `applications.e2e-spec.ts` ("returns only the applicant-safe fields"): keys match exactly | **Pass** |
| TC-MYAPP-02 | Status is worded for the applicant | 1. Move the application to Screening<br>2. GET `/api/applications/mine` | `status` is `Under review`, not `Screening` | Same test: `status` is `Under review` | **Pass** |
| TC-MYAPP-03 | Only applications sent with the applicant's email, in any letter case | 1. Add applications sent with the applicant's email, the same email in capitals, and another email<br>2. GET `/api/applications/mine` | The first two are listed; the other email's is not | `applications.e2e-spec.ts` ("lists only their own applications, in any letter case") | **Pass** |
| TC-MYAPP-04 | Newest application first | 1. Do TC-MYAPP-03 | The later application comes before the earlier one | Same test: the capitals application, added last, is listed first | **Pass** |
| TC-MYAPP-05 | Staff and signed-out visitors are kept out | 1. GET `/api/applications/mine` as manager, as recruiter, and with no token | 403, 403, 401 | `applications.e2e-spec.ts` ("keeps staff (403) and signed-out visitors (401) out"); manager also got 403 by hand | **Pass** |

## 2. My Applications page (`/careers/applications`)

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-MYAPP-06 | Each application shows its role, date, and status | 1. Sign in as an applicant with applications<br>2. Open My Applications | One card each: role title linking to `/careers/:id`, "Applied …", and a badge with the status written out | `my-applications.spec.ts` ("lists each application with a link, date, and status"); by hand: three cards with Submitted and Interview badges | **Pass** |
| TC-MYAPP-07 | The page says which email it shows | 1. Do TC-MYAPP-06 | "Showing applications sent with {email}" and a note that other emails won't appear | `my-applications.spec.ts` ("says which email the list is for"); seen by hand | **Pass** |
| TC-MYAPP-08 | Empty state | 1. Sign in as an applicant with no applications<br>2. Open My Applications | "You haven't applied yet" with a link to `/careers` | `my-applications.spec.ts` ("shows the empty state with a link to open roles") | **Pass** |
| TC-MYAPP-09 | Error and Try again | 1. Open My Applications while the API fails<br>2. Click Try again once it works | The error shows with Try again; the list loads after | `my-applications.spec.ts` ("shows the error and loads again on Try again") | **Pass** |

## 3. Access and links

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-MYAPP-10 | Signed-out visitors sign in first, then come back | 1. Sign out<br>2. Open `/careers/applications`<br>3. Sign in as an applicant | Sent to `/careers/login?returnUrl=%2Fcareers%2Fapplications`, then back to My Applications | `auth.guards.spec.ts` ("sends a signed-out visitor to the applicant sign-in"); by hand: redirected, and back on the page after signing in | **Pass** |
| TC-MYAPP-11 | Staff can't open the page | 1. Sign in as `manager@talentflow.dev`<br>2. Open `/careers/applications` | Sent to `/dashboard` | `auth.guards.spec.ts` ("sends staff to their dashboard"); by hand: landed on `/dashboard` | **Pass** |
| TC-MYAPP-12 | Careers header links to My Applications | 1. Sign in as an applicant<br>2. Open `/careers` and click My Applications | Opens `/careers/applications` | `public-shell.spec.ts` ("links a signed-in applicant to My Applications"); clicked by hand | **Pass** |
| TC-MYAPP-13 | Signed-in applicant can track a new application | 1. Sign in as an applicant<br>2. Apply for an open role<br>3. Click Track this application | The thank-you screen shows Track this application; it opens My Applications with the new application first | `apply.spec.ts` ("lets a signed-in applicant track the application"); by hand: link shown, new application listed first | **Pass** |
| TC-MYAPP-14 | Signed-out applicant is offered an account | 1. Sign out<br>2. Apply for an open role | The thank-you screen shows "Create an account with this email to track it" linking to `/careers/register` | `apply.spec.ts` ("sends the application, then the resume, then says thanks") | **Pass** (check once by hand) |

## Notes

- Applications have no user id, so they are matched on the application email. Sign-up does not
  verify emails yet, so someone could register with another person's email and see that person's
  applications. This is a follow-up, not fixed here.
- The full e2e run had 107/108 passing. The one failure, `auth.e2e-spec.ts` ("keeps a signed-in
  applicant out of staff-only endpoints"), signs in as the sample `applicant@talentflow.dev`, which
  could not sign in on the local database used for this run. It is not related to this change.
- `dashboard.e2e-spec.ts` ("count down \"awaiting your rating\" as they rate") failed in some full
  e2e runs and passed in others and on its own. It also failed with `applications.e2e-spec.ts`
  left out, so it is not caused by this change.
- The checks by hand used a throwaway applicant account on the local database, not the sample
  applicant.
