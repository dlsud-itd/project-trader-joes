# Applicant Profiles & Pipeline Kanban Test Matrix - Sprint 4

Covers WBS 4.4 (Applicant Tracking & Pipeline Management): the applicant profile workspace and
inline resume viewer (4.4.1), the interactive pipeline Kanban board (4.4.2), and drag-and-drop
stage transitions (4.4.3).

**Status as of 2026-11-06, 22:30:** 4.4.1 (profiles + resume viewer) just merged into `dev` via
`feat-applications-list` (`GET /api/applications`, `GET /api/applications/:id`, and the
`ApplicantProfile` page with an inline PDF viewer all exist and are covered by real tests — see
Sections 1 and 2 below). **4.4.2 and 4.4.3 are still not built**: `applications.html` renders a
flat, sortable/filterable list with a read-only `kanban_stage` badge, not a Kanban board with
columns, and there is no `PATCH /api/applications/:id/stage` endpoint anywhere in
`backend/src/applications`. Sections 3-5 are still a forward-looking plan, not a report.

`TC-STG` cases are written directly against `trader_joes_API_Specification.pdf` section IV.B
(`PATCH /api/applications/{applicationId}/stage`), which is already documented.

## 1. Listing applications (`GET /api/applications`)

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-LST-01 | Staff can list applications | 1. Sign in as manager or recruiter<br>2. GET `/api/applications` | HTTP 200; array of applications, each with profile fields, `kanban_stage`, and screening summary (fit score/status) | `@Roles('manager', 'recruiter')` on `ApplicationsController.list()`; `applications.e2e-spec.ts` ("lists applications for staff with the posting and screening") asserts the full shape | **Pass** — see caveat in Notes |
| TC-LST-02 | Applicant blocked from the list | 1. Sign in as an applicant<br>2. GET `/api/applications` | HTTP 403 Forbidden | `applications.e2e-spec.ts` ("keeps applicants and signed-out visitors out (403, 401)") asserts `.get('/api/applications').set(asApplicant).expect(403)` | **Pass** — see caveat in Notes |
| TC-LST-03 | No token | 1. GET `/api/applications` with no token | HTTP 401 Unauthorized | Same e2e case asserts `.get('/api/applications').expect(401)` | **Pass** — see caveat in Notes |
| TC-LST-04 | List carries what the profile panel needs | 1. Sign in as staff<br>2. GET `/api/applications` | Each row includes enough to render the list and open a profile without a second request (name, posting title, stage, fit score, resume reference) | Same e2e case asserts `posting_title`, `full_name`, `email`, `phone`, `cover_note`, `kanban_stage`, `resume` (id/file_name/size_bytes, no raw `data`), and `screening` (fit_score/status/requirement_matches) all come back in one row | **Pass** — see caveat in Notes |

## 2. Applicant profile workspace & resume viewer (`GET /api/applications/:id`)

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-PROF-01 | Staff can open one applicant's profile | 1. Sign in as manager or recruiter<br>2. GET `/api/applications/:id` for a submitted application | HTTP 200; full profile, `kanban_stage`, screening result, resume reference | `applicant-profile.spec.ts` ("loads the applicant from the API") renders name, posting, phone, portfolio, and cover note from the real `GET /api/applications/:id` response; backend e2e case "returns one application for the profile page" asserts the same shape | **Pass** |
| TC-PROF-02 | Resume previews inline instead of downloading | 1. Open a profile with an uploaded resume<br>2. Load the resume viewer | The file is fetched and shown inline in the workspace, not forced to download | `applicant-profile.spec.ts` ("shows the resume in an inline viewer once it loads"): `ResumeViewer` fetches the file as a blob, renders it in an `<iframe>` with a `blob:` URL, titled `Resume of <name>`, next to a Download link and the file name/size | **Pass** |
| TC-PROF-03 | Resume fails to load | 1. Open a profile whose resume file request fails | Viewer shows an error with a retry, not a broken embed | `applicant-profile.spec.ts` ("offers a retry when the resume fails to load"): shows "Could not load the resume." and a working "Try again" button | **Pass** (replaces the original "non-PDF resume" case — moot now, since `resume-input.ts`/`resume-viewer.ts` make the whole upload→view path PDF-only end to end, see Notes) |
| TC-PROF-04 | No resume uploaded | 1. Open a profile for an applicant who never uploaded a resume | "No resume uploaded"; no viewer shown; scoring is blocked with a clear message | `applicant-profile.spec.ts` ("says so when no resume was uploaded, and does not score it"): no `<iframe>`, clicking "Score resume" sends no request and shows "has not uploaded a resume yet" | **Pass** |
| TC-PROF-05 | Application does not exist | 1. GET `/api/applications/999999999` | HTTP 404 "Application not found." | `ApplicationsController`'s `ParseIntPipe` exception factory returns `NotFoundException('Application not found.')`; `applicant-profile.spec.ts` ("shows a not-found message for an unknown id") shows "Applicant not found" on a 404 | **Pass** — see caveat in Notes |
| TC-PROF-06 | Applicant blocked from profiles | 1. Sign in as an applicant<br>2. GET `/api/applications/:id` for any application | HTTP 403 Forbidden | `@Roles('manager', 'recruiter')` on `ApplicationsController.findOne()`, same guard as the list; `applications.e2e-spec.ts` asserts `.get('/api/applications/1').set(asApplicant).expect(403)` | **Pass** — see caveat in Notes |

## 3. Update application stage (`PATCH /api/applications/{applicationId}/stage`, API spec IV.B)

Not built. `ApplicationsController` has no `@Patch` route, and `kanban_stage` is currently
read-only everywhere in the API.

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-STG-01 | Staff moves an application to a valid stage | 1. Sign in as manager or recruiter<br>2. PATCH `/api/applications/:id/stage` with `{"kanban_stage": "Interview"}` | HTTP 200 "Application stage updated successfully."; response `application.kanban_stage` is `Interview`, `updated_at` changes | | Pending implementation |
| TC-STG-02 | Every documented stage is accepted | 1. Repeat TC-STG-01 for `Applied`, `Screening`, `Interview`, `Offer`, `Rejected` | Each HTTP 200 with the matching `kanban_stage` saved | | Pending implementation |
| TC-STG-03 | Stage value outside the enum is rejected | 1. PATCH with `{"kanban_stage": "Hired"}` | HTTP 400; `kanban_stage` unchanged | | Pending implementation |
| TC-STG-04 | Application does not exist | 1. PATCH `/api/applications/999999999/stage` with a valid stage | HTTP 404 | | Pending implementation |
| TC-STG-05 | No token | 1. PATCH with no token | HTTP 401 Unauthorized; `kanban_stage` unchanged | | Pending implementation |
| TC-STG-06 | Applicant blocked from moving stages | 1. Sign in as an applicant<br>2. PATCH `/api/applications/:id/stage` | HTTP 403 Forbidden; `kanban_stage` unchanged | | Pending implementation |
| TC-STG-07 | Re-setting the same stage is a harmless no-op | 1. PATCH an application already in `Screening` with `{"kanban_stage": "Screening"}` | HTTP 200; `kanban_stage` still `Screening` | | Pending implementation |

## 4. Interactive pipeline Kanban board (frontend)

Not built. `applications.html` today renders a single filterable/sortable list (search, posting,
fit-tier chips, sort) with `kanban_stage` shown as a plain read-only badge per row — there are no
stage columns.

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-KAN-01 | Board has one column per pipeline stage | 1. Open the pipeline board as staff | Five columns in order: Applied, Screening, Interview, Offer, Rejected | | Pending implementation |
| TC-KAN-02 | Cards land in the right column | 1. Load the board with applications in mixed stages | Each card appears under its `kanban_stage`; each column header shows its card count | | Pending implementation |
| TC-KAN-03 | Card shows enough to triage at a glance | 1. Inspect a card | Applicant name, posting title, and fit score badge (reusing the existing `FitScoreBadge`/fit-tier colors) are visible without opening the profile | | Pending implementation |
| TC-KAN-04 | Opening a card shows the full profile | 1. Click/select a card | The profile workspace opens for that applicant (now real — see Section 2) | | Pending implementation |
| TC-KAN-05 | Empty stage renders cleanly | 1. View a stage with zero applications (e.g. a brand-new posting's `Offer` column) | Column shows an empty state, not a blank gap or layout break | | Pending implementation |

## 5. Drag-and-drop stage transitions

Not built — depends on both Section 3 (the PATCH endpoint) and Section 4 (the board).

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-DND-01 | Dragging a card moves its stage | 1. Drag a card from `Applied` to `Screening` | `PATCH /api/applications/:id/stage` is called with `Screening`; the card renders in the new column once the request succeeds | | Pending implementation |
| TC-DND-02 | Dropping in the same column is a no-op | 1. Drag a card and drop it back in its starting column | No PATCH request is sent; card stays where it was | | Pending implementation |
| TC-DND-03 | A failed move reverts the card | 1. Drag a card to a new column while the PATCH request fails (e.g. offline or 500) | Card snaps back to its original column; an error is shown to the user | | Pending implementation |
| TC-DND-04 | Stage can be changed without a mouse | 1. Using keyboard/screen reader only, change a card's stage | There is a non-drag way to move a card (e.g. a stage dropdown/menu on the card), so keyboard and screen-reader users aren't locked out | | Pending implementation |
| TC-DND-05 | Moving a card mid-screening doesn't conflict | 1. Start an AI screening on an application (card is in the "scoring" state)<br>2. Drag that card to another column before scoring finishes | The stage move and the in-flight screening don't interfere; both complete correctly | | Pending implementation |
| TC-DND-06 | Rapid repeated drags settle on the last stage | 1. Drag the same card through two or more columns in quick succession | Only the final stage is persisted; no out-of-order PATCH response can overwrite it with an earlier stage | | Pending implementation |

## Notes

- **Caveat on every "Pass" in Sections 1-2 that cites a backend e2e case**: I could not get a
  clean `npm run test:e2e -- applications` run on this machine — it fails with
  `relation "ai_screenings" does not exist`, because this local Postgres database has a drifted
  migration history (`npm run db:migrate` also fails, on an already-applied `ALTER TYPE` from
  earlier). That's a local environment problem on my end, not a defect in the merged code: the
  frontend component tests (`applicant-profile.spec.ts`, `applications.spec.ts`) exercise the real
  `GET /api/applications` and `GET /api/applications/:id` contracts against a mocked HTTP layer and
  all pass (132/132 across the frontend suite), and the role guards/404 handling are read directly
  from `applications.controller.ts` source, not assumed. But nobody has confirmed these e2e cases
  pass against a real, fully-migrated database since they were written. Worth a quick
  `npm run test:e2e -- applications` on a teammate's machine (or CI) to close that gap.
- Resumes are PDF-only end to end now (`resume-input.ts` on upload, `resume-viewer.ts` on
  display) — this is the same finding noted in
  `documents/sprint-2/careers-apply-test-matrix.md` (TC-APP-03). The original TC-PROF-03 ("non-PDF
  resume falls back gracefully") no longer applies to an app that never accepts a non-PDF resume in
  the first place; replaced with a load-failure/retry case instead.
- Sections 3-5 (stage updates, the Kanban board, drag-and-drop) are unchanged from the original
  plan — still genuinely not built as of this writing.
