# Applications API Test Matrix - Sprint 3

Tests `POST /api/applications`. TC-APL cases are covered by `backend/test/applications.e2e-spec.ts`
(`npm run test:e2e -- applications`); TC-DTO cases by
`backend/src/applications/dto/create-application.dto.spec.ts` (`npm test -- create-application`).
They can also be run by hand at `http://localhost:3000/api/docs`. Results below are from the
automated run on 2026-10-31 against a local database.

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-APL-01 | Apply to an open posting without signing in | 1. As manager, create an open posting<br>2. With no token, POST name, email, phone, link, and cover note | HTTP 201 "Application submitted successfully.", `kanban_stage` is `Applied`, 64-character `upload_token`; profile saved with every field | HTTP 201 with the message, `kanban_stage` `Applied`, a 64-character hex `upload_token`; saved profile matches what was sent | **Pass** |
| TC-APL-02 | Same email twice, different letter case | 1. Apply as in TC-APL-01<br>2. Apply again to the same posting as `E2E.Juan@Example.com` | HTTP 409 "You have already applied for this position with this email." | HTTP 409 "You have already applied for this position with this email." | **Pass** |
| TC-APL-03 | Closed posting | 1. Create a closed posting<br>2. Apply to it | HTTP 400 "This position is no longer accepting applications." | HTTP 400 "This position is no longer accepting applications." | **Pass** |
| TC-APL-04 | Posting that does not exist | 1. Apply with `job_posting_id` 999999999 | HTTP 404 "Job posting not found." | HTTP 404 | **Pass** |
| TC-APL-05 | Every invalid field is listed | 1. Apply with an empty name and email `nope` | HTTP 400 "Some fields are invalid." with "Enter your full name." and "Enter a valid email address." in `details` | HTTP 400 with both messages in `details` | **Pass** |
| TC-APL-06 | Applicant can't choose a pipeline stage | 1. Apply with `kanban_stage: "Offer"` added | HTTP 400; no application created | HTTP 400 | **Pass** |
| TC-DTO-01 | Required fields only | 1. Send only posting id, name, and email | No errors | No errors | **Pass** |
| TC-DTO-02 | Name and email are cleaned | 1. Send `"  Juan Dela Cruz "` and `" Juan@Example.COM "` | Saved as `Juan Dela Cruz` and `juan@example.com` | `Juan Dela Cruz` and `juan@example.com` | **Pass** |
| TC-DTO-03 | Blank optional fields | 1. Send phone `"  "`, link `""`, cover note `" "` | No errors; the three fields are left empty | No errors; all three empty | **Pass** |
| TC-DTO-04 | Bad required fields | 1. Send posting id `abc`, name `J`, email `not-an-email` | Errors on `job_posting_id`, `full_name`, and `email` | Errors on all three | **Pass** |
| TC-DTO-05 | Posting id sent as text | 1. Send `job_posting_id: "7"` (as a form post does) | Accepted as the number 7 | Accepted as 7 | **Pass** |
| TC-DTO-06 | Phone number format | 1. Try `+63 917 123 4567`, `(02) 8123-4567`, `call me`, `123` | First two accepted; last two rejected with "Enter a valid phone number, e.g. +63 917 123 4567." | First two accepted, last two rejected | **Pass** |
| TC-DTO-07 | Portfolio link | 1. Try `https://github.com/juan`, `github.com/juan`, `javascript:alert(1)` | Only the `https://` link is accepted; others get "Enter a full link starting with https://." | Only the `https://` link accepted | **Pass** |
| TC-DTO-08 | Cover note length | 1. Send 2,000 characters, then 2,001 | 2,000 accepted; 2,001 rejected with "Cover note must be 2,000 characters or fewer." | 2,000 accepted, 2,001 rejected | **Pass** |
| TC-DTO-09 | Fields not on the form | 1. Send `kanban_stage: "Offer"` | Error on `kanban_stage` | Error on `kanban_stage` | **Pass** |
