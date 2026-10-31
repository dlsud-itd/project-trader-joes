# Job Postings API Test Matrix - Sprint 3

Tests `/api/job-postings` (list, view, create, edit, open/close, delete). TC-JOB cases are covered by
`backend/test/job-postings.e2e-spec.ts` (`npm run test:e2e -- job-postings`); TC-DTO cases by
`backend/src/job-postings/dto/create-job-posting.dto.spec.ts` (`npm test -- create-job-posting`).
They can also be run by hand at `http://localhost:3000/api/docs`. Results below are from the
automated run on 2026-10-31 against a local database with the seeded sample accounts.

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-JOB-01 | Manager creates a posting; requirements are cleaned | 1. Sign in as `manager@talentflow.dev`<br>2. POST a posting with requirements `- JavaScript\n\nSQL\nsql\nGit` | HTTP 201 "Job posting created successfully."; requirements saved as `JavaScript\nSQL\nGit`; `status` defaults to `open` | HTTP 201; requirements `JavaScript\nSQL\nGit`; status `open` | **Pass** |
| TC-JOB-02 | Only managers can create | 1. POST a valid posting as `recruiter@talentflow.dev`<br>2. POST it again with no token | HTTP 403 for the recruiter; HTTP 401 with no token | HTTP 403, then HTTP 401 | **Pass** |
| TC-JOB-03 | Every invalid field is listed | 1. As manager, POST with title `x` and empty requirements | HTTP 400 with 2 entries in `details` (title, requirements) | HTTP 400 with 2 entries in `details` | **Pass** |
| TC-JOB-04 | Edit one field | 1. Create a posting<br>2. PATCH `{ "location": "Makati" }` | HTTP 200 "Job posting updated successfully."; location is `Makati`, title unchanged | HTTP 200; location `Makati`, title unchanged | **Pass** |
| TC-JOB-05 | A required field can't be cleared on edit | 1. PATCH `{ "title": null }` | HTTP 400 "These fields can't be empty: title." | HTTP 400 | **Pass** |
| TC-JOB-06 | Posting that does not exist | 1. PATCH `/api/job-postings/999999`<br>2. GET `/api/job-postings/not-a-number` | HTTP 404 "Job posting not found." for both | HTTP 404 for both | **Pass** |
| TC-JOB-07 | Closing hides a posting from visitors, not staff | 1. Create a posting; GET it with no token<br>2. PATCH `/status` to `closed`<br>3. GET it with no token<br>4. List `?status=closed` with no token, then as recruiter | Step 1 HTTP 200; step 2 HTTP 200 with `status: closed`; step 3 HTTP 404; public list leaves it out; staff list includes it | 200; 200 `closed`; 404; missing from public list, present in staff list | **Pass** |
| TC-JOB-08 | Recruiter can't open or close postings | 1. As recruiter, PATCH `/status` to `closed` | HTTP 403 | HTTP 403 | **Pass** |
| TC-JOB-09 | Visitors don't see internal fields | 1. Create a posting<br>2. GET it with no token | HTTP 200 without `created_by` or `author` | HTTP 200; neither field present | **Pass** |
| TC-JOB-10 | Delete a posting with no applicants | 1. Create a posting<br>2. DELETE it as manager<br>3. GET it as manager | HTTP 200 "Job posting deleted."; then HTTP 404 | HTTP 200 "Job posting deleted."; then HTTP 404 | **Pass** |
| TC-JOB-11 | Posting with applicants can't be deleted | 1. Create a posting and add an application to it<br>2. DELETE it as manager<br>3. GET it as manager | HTTP 409 "...can't be deleted. Close it instead."; posting still exists (HTTP 200) | HTTP 409 "Close it instead"; GET returns 200 | **Pass** |
| TC-JOB-12 | Only managers can delete | 1. DELETE a posting as recruiter<br>2. DELETE it with no token | HTTP 403, then HTTP 401 | HTTP 403, then HTTP 401 | **Pass** |
| TC-JOB-13 | Delete a posting that does not exist | 1. DELETE `/api/job-postings/999999999` as manager | HTTP 404 | HTTP 404 | **Pass** |
| TC-DTO-01 | API spec sample | 1. Send title, department, location, description, requirements, `status: open` | No errors | No errors | **Pass** |
| TC-DTO-02 | Status is optional | 1. Send the sample without `status` | No errors | No errors | **Pass** |
| TC-DTO-03 | Text is trimmed before length checks | 1. Send title `"   QA   "` | Trimmed to `QA`; error on `title` (minimum 3 characters) | Trimmed to `QA`; error on `title` | **Pass** |
| TC-DTO-04 | Requirements are cleaned | 1. Send `"  SQL \n\nGit\nsql\n"`<br>2. Send `- React`, `* Angular`, `• Vue`, `1. Node`, `2) Nest` on separate lines<br>3. Send `[" Git ", "Docker", ""]` | 1. `SQL\nGit`<br>2. `React\nAngular\nVue\nNode\nNest`<br>3. `Git\nDocker` | All three match | **Pass** |
| TC-DTO-05 | Commas stay inside one requirement | 1. Send `2+ years with React, Angular, or Vue` | Kept as one requirement | Kept as one requirement | **Pass** |
| TC-DTO-06 | Empty requirements | 1. Send requirements `" \n "` | Error on `requirements` | Error on `requirements` | **Pass** |
| TC-DTO-07 | Too many requirements | 1. Send 26 requirements | Error on `requirements` ("Add 1 to 25 requirements...") | Error on `requirements` | **Pass** |
| TC-DTO-08 | Unknown status | 1. Send `status: "draft"` | Error on `status` | Error on `status` | **Pass** |
| TC-DTO-09 | Missing required fields | 1. Send `{}` | Errors on title, department, location, description, requirements | Errors on all five | **Pass** |
| TC-DTO-10 | Edit sends only changed fields | 1. Send `{ "location": "Makati" }` to the update DTO<br>2. Send `{ "title": "x" }` | 1. No errors<br>2. Error on `title` | 1. No errors<br>2. Error on `title` | **Pass** |
| TC-DTO-11 | Status change needs a value | 1. Send `{ "status": "closed" }`<br>2. Send `{}` | 1. No errors<br>2. Error on `status` | 1. No errors<br>2. Error on `status` | **Pass** |
