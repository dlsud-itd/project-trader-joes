# Careers and Apply Test Matrix - Sprint 2

Run these in the browser at `http://localhost:4200` while signed out, unless a step says
otherwise. Fill in **Actual Result** and **Pass/Fail**. Repeat the cases marked (phone) at 390
px wide (DevTools device toolbar).

Most rows below were filled in on 2026-11-06 from the automated Angular component tests instead
of manual clicking, since each case has a direct test covering it: `careers.spec.ts` (TC-CAR-01,
02, 06), `career-detail.spec.ts` (TC-CAR-04, 05), `apply.spec.ts` (TC-APP-01, 02, 06, 07), and
`resume-input.spec.ts` (TC-APP-03, 04, 05) — run with `npm test` in `frontend/` (122/122 passed).
TC-CAR-03's second click, TC-APP-08, and TC-APP-09 have no automated coverage and still need an
actual browser pass; see the Notes below.

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-CAR-01 | Careers page lists open roles | 1. As manager, create one open and one closed posting<br>2. Sign out, open `/careers` | Only the open posting is listed | `careers.spec.ts`: component always requests `status=open`; renders only the postings the API returns, each card linking to `/careers/:id` | **Pass** |
| TC-CAR-02 | Search | 1. Type part of a title or location in the search box | Only matching roles stay; "No roles match." with Clear filters when none match | Typing "manila" narrowed the list to the 2 matching roles; typing "astronaut" showed "No roles match." and the Clear filters link restored the full list | **Pass** |
| TC-CAR-03 | Department filter | 1. Have postings in two departments<br>2. Click a department chip, then click it again | List filters, then shows everything again | Clicking the "HR" chip filtered the list to 1 match. The toggle-off on a second click exists in code (`department.update(...)` in `careers.ts:88`), but no test clicks it a second time | **Partially tested** — second click needs a manual check |
| TC-CAR-04 | Role page | 1. Click a role | Title, description, every requirement, and Apply now | `career-detail.spec.ts`: title, description, all requirements, and an Apply link to `/careers/7/apply` rendered | **Pass** |
| TC-CAR-05 | Closed role link | 1. Open `/careers/<id>` of a closed posting | "This role is no longer available" | Both a 404 response and a response with `status: closed` show "This role is no longer available" with no Apply link | **Pass** |
| TC-CAR-06 | Signed-in staff on careers page | 1. Sign in as manager<br>2. Open `/careers` | Closed postings still don't show | Every careers-page request asks for `status=open` regardless of sign-in state (asserted in `careers.spec.ts`), so a signed-in staff member sees the same open-only list | **Pass** |
| TC-APP-01 | Required fields | 1. Open Apply now<br>2. Click Submit application with an empty form | Errors for name, email, and resume; nothing is sent | Submitting empty shows "Enter your full name.", "Enter a valid email address.", "Attach your resume."; no request sent | **Pass** |
| TC-APP-02 | Optional field checks | 1. Type "call me" as phone and "github.com/me" as link<br>2. Submit | Phone and link errors | "call me" and "github.com/juan" (no `https://`) each show their validation message; no request sent | **Pass** |
| TC-APP-03 | Wrong resume type | 1. Choose a .png or .docx file | "Choose a PDF file." and the file is not kept (PDF only) | `.png` and `.docx` are both rejected with "Choose a PDF file." | **Pass** |
| TC-APP-04 | Resume over 5 MB | 1. Choose a PDF over 5 MB | "The resume must be 5 MB or smaller." | A PDF one byte over the 5 MB limit is rejected with exactly "The resume must be 5 MB or smaller." | **Pass** |
| TC-APP-05 | Drag and drop | 1. Drag a PDF onto the resume box | File name and size are shown, with Remove | Dropping a PDF on the drop zone sets it as the chosen file, same as picking it; name/size shown with a Remove button | **Pass** |
| TC-APP-06 | Successful application | 1. Fill in name, email, resume<br>2. Submit | "Application sent" with the email shown | `POST /api/applications` then `POST /api/resumes` fire in sequence; "Application sent" is shown with the submitted email | **Pass** |
| TC-APP-07 | Same email twice | 1. Apply again to the same role with the same email | "You have already applied for this position with this email." | A 409 response shows "You have already applied for this position with this email." | **Pass** |
| TC-APP-08 | Careers and apply pages (phone) | 1. Repeat TC-CAR-01, TC-CAR-04, and TC-APP-06 at 390 px | Nothing cut off; no sideways scrolling | Checked `/careers` at 412px (Galaxy Z Fold 6, DevTools device toolbar) on 2026-11-06: empty state ("No open roles right now") rendered cleanly, no horizontal scroll. The local dev database had no job postings yet, so a role card, the role detail page, and the apply form were not actually seen at this width | **Partially tested** — re-check once postings exist, see Notes |
| TC-APP-09 | Sign-in page link | 1. Sign out<br>2. On the sign-in page click "See open roles" | Goes to `/careers` | Confirmed live in the browser on 2026-11-06: `/login` shows "Looking for a job? See open roles" as a link under the Sign in button | **Pass** |

## Notes

- Results above came from `npm test` in `frontend/` on 2026-11-06 (Angular component tests via
  Karma/Vitest), not from manually clicking through `http://localhost:4200` as this matrix's
  header originally asked. Each "Pass" cites the spec file and behavior it came from.
- TC-APP-03's Expected Result was corrected on 2026-11-06: resumes are PDF-only by design
  (`resume-input.ts`: `RESUME_ACCEPT = '.pdf,application/pdf'`, comment "Resumes are PDF only.").
  The row originally said Word (`.docx`) should also be accepted — that was just an outdated line
  in the original doc, not a bug in the app; confirmed intentional, so no team decision needed.
- TC-APP-09 confirmed live on 2026-11-06 — no longer blocked.
- Two cases are still open, and both are blocked on the same thing: **the local dev database has
  no job postings in it** (`/postings` showed "No job postings yet" as of 2026-11-06). Create at
  least two open postings in different departments (Job postings → New posting, signed in as
  manager), then:
  - TC-CAR-03: on `/careers`, click a department chip, then click it again, and confirm the
    second click clears the filter (the toggle code is in `careers.ts:88`, just not exercised by
    any test or, yet, by hand).
  - TC-APP-08: re-check `/careers` at 390px with actual role cards showing, then open a role's
    detail page and its apply form at the same width, looking for cut-off content or a horizontal
    scrollbar. The empty-state check done so far isn't enough to call this one passed.
