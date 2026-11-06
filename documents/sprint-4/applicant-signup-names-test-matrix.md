# Sign-up Names Test Matrix - Sprint 4

Covers the "Fix: applicant names on sign-up" task (branch `fix-applicant-signup-names`):

- Names on the applicant sign-up page and the staff Team page are trimmed, and names made of
  only spaces are rejected, on both the page and the API.
- The Apply form starts with a signed-in applicant's name and email, so the application matches
  the account.

`TC-NAME` cases are covered by `backend/src/auth/dto/register-applicant.dto.spec.ts`,
`backend/src/auth/dto/register.dto.spec.ts` (`npm test --prefix backend -- register`) and
`frontend/src/app/pages/applicant-register/applicant-register.spec.ts`. `TC-PRE` cases are
covered by `frontend/src/app/pages/apply/apply.spec.ts`. The shared check is
`frontend/src/app/shared/validators/not-blank.ts`. Results below are from the automated run on
2026-11-07 (frontend 158/158, backend 118/118).

## 1. Names on sign-up (`/careers/register`, `POST /api/auth/register-applicant`)

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-NAME-01 | Valid names are accepted | 1. Open `/careers/register`<br>2. Enter `Ana` / `Cruz`, a valid email and password<br>3. Click Create account | Account is created, applicant is signed in and sent to the careers page | `applicant-register.spec.ts` ("registers, signs in, and disables the button while busy") and `register-applicant.dto.spec.ts` ("accepts a valid sign-up") | **Pass** |
| TC-NAME-02 | Names of only spaces are blocked on the page | 1. Enter a single space as first and last name<br>2. Click Create account | "Enter your first name." and "Enter your last name." appear; nothing is sent | `applicant-register.spec.ts` ("does not accept names made of only spaces"): no request to `/auth/register-applicant`, both fields show their error | **Pass** |
| TC-NAME-03 | Spaces around names are removed before sending | 1. Enter ` Ana ` / `Cruz  `<br>2. Click Create account | Request body has `Ana` / `Cruz` | `applicant-register.spec.ts` ("sends the names without extra spaces") | **Pass** |
| TC-NAME-04 | API trims names | 1. POST `/api/auth/register-applicant` with `"  Ana "` / `" Cruz  "` | HTTP 201; account saved as `Ana` / `Cruz` | `register-applicant.dto.spec.ts` ("trims spaces around the names") | **Pass** |
| TC-NAME-05 | API rejects names of only spaces | 1. POST `/api/auth/register-applicant` with `"   "` / `" "` | HTTP 400 with "Enter a first name." and "Enter a last name." | `register-applicant.dto.spec.ts` ("rejects names made of only spaces"): both fields fail | **Pass** |

## 2. Names on the Team page (`/team`, `POST /api/auth/register`)

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-NAME-06 | Team page blocks names of only spaces | 1. Sign in as `manager@talentflow.dev`<br>2. Open Team<br>3. Enter a single space as first name, fill the rest<br>4. Click Create account | "Enter a first name." appears; nothing is sent | `team.ts` uses the same `notBlank` check, covered by `not-blank.spec.ts` | **Pass** (check once by hand, no Team page spec yet) |
| TC-NAME-07 | API trims staff names | 1. As manager, POST `/api/auth/register` with `" Rico "` / `"Reyes  "` | HTTP 201; account saved as `Rico` / `Reyes` | `register.dto.spec.ts` ("trims spaces around the names") | **Pass** |
| TC-NAME-08 | API rejects staff names of only spaces | 1. As manager, POST `/api/auth/register` with `"  "` / `" "` | HTTP 400 | `register.dto.spec.ts` ("rejects names made of only spaces") | **Pass** |

## 3. Apply form pre-fill (`/careers/:id/apply`)

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-PRE-01 | Signed-in applicant's details are filled in | 1. Sign in as `applicant@talentflow.dev`<br>2. Open an open posting and click Apply | Full name and Email already hold the account's name and email | `apply.spec.ts` ("fills in the name and email of a signed-in applicant") | **Pass** |
| TC-PRE-02 | Filled-in details can still be changed | 1. Do TC-PRE-01<br>2. Change the full name, submit | The application is saved with the edited name | Fields stay normal form inputs; `apply.spec.ts` ("keeps what the applicant already typed") shows typed text is never overwritten | **Pass** |
| TC-PRE-03 | Works after refreshing the Apply page | 1. Do TC-PRE-01<br>2. Refresh the page | Details are filled in again once the session loads | The form fills in when the signed-in user arrives, not only on page load | **Pass** (check once by hand) |
| TC-PRE-04 | Visitors get an empty form | 1. Sign out<br>2. Open Apply for a posting | Full name and Email are empty | No user, so nothing is filled in; existing `apply.spec.ts` cases run signed out | **Pass** |
| TC-PRE-05 | Staff get an empty form | 1. Sign in as a recruiter<br>2. Open `/careers/:id/apply` | Full name and Email are empty | `apply.spec.ts` ("does not fill in the form for staff") | **Pass** |

## Notes

- Accounts created before this fix may still have spaces around their names. Nothing changes
  existing rows; only new sign-ups are cleaned.
- TC-NAME-06 and TC-PRE-03 should be checked once by hand in the browser before merging.
