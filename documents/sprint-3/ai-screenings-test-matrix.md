# AI Screening and Retries Test Matrix - Sprint 3

Tests `/api/ai-screenings` and the retry and failure handling behind it. TC-AIS cases are covered by
`backend/test/ai-screenings.e2e-spec.ts` (`npm run test:e2e -- ai-screenings`), which replaces Gemini
with a fake so no API key or quota is needed. TC-GEM, TC-QUE, TC-RES, and TC-FAIL cases are covered by
the unit tests in `backend/src/ai-screenings/` (`npm test -- ai-screenings`). Results below are from
the automated run on 2026-10-31 against a local database with the seeded sample accounts.

## Screening API

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-AIS-01 | Screen a resume and save the score | 1. Create a posting with requirements JavaScript, SQL, Git<br>2. Add an application with a resume<br>3. Gemini answers met / partial / missing<br>4. POST `{ application_id }`<br>5. GET `/api/ai-screenings/:id` | HTTP 200 "AI screening processed successfully."; `fit_score` 50, `status` `completed`, `retry_count` 0; requirements listed in posting order; prompt contains the numbered requirements and resume text; GET returns the saved score | HTTP 200; fit score 50, completed, retry count 0; prompt and saved result match | **Pass** |
| TC-AIS-02 | Screening twice returns the saved score | 1. Screen an application<br>2. POST the same application again without `retry` | HTTP 200 with the same score; Gemini called only once | HTTP 200, score 50; Gemini called once | **Pass** |
| TC-AIS-03 | Gemini is busy after its automatic retries | 1. Gemini fails as BUSY<br>2. POST `{ application_id }` | HTTP 422 "AI screening could not be completed.", `status` `failed`, `retry_count` 0, reason "The AI service is busy right now. Try again in a few minutes."; failed row saved with `fit_score` null | HTTP 422 with that body; failed row saved | **Pass** |
| TC-AIS-04 | Daily Gemini limit used up | 1. Gemini fails with DAILY_LIMIT<br>2. POST `{ application_id }` | HTTP 422; reason "...Try again tomorrow." | HTTP 422 with "Try again tomorrow" | **Pass** |
| TC-AIS-05 | Gemini gives an unusable answer | 1. Gemini replies `The candidate looks great!` (not JSON)<br>2. POST `{ application_id }` | HTTP 422, `status` `failed`, reason "The AI service gave an unusable answer. Try again." | HTTP 422 with that reason | **Pass** |
| TC-AIS-06 | Retry after a failure | 1. First screening fails (BUSY)<br>2. POST again without `retry`<br>3. POST with `retry: true` while Gemini works | Step 2: HTTP 409 asking to send `"retry": true`<br>Step 3: HTTP 200, `completed`, `fit_score` 50, `retry_count` 1, `failure_reason` null | 409, then 200 with retry count 1 and no failure reason | **Pass** |
| TC-AIS-07 | Double click screens only once | 1. Send two POSTs for the same application at the same time | Both HTTP 200 with the same screening id; Gemini called once | Both 200, same id; Gemini called once | **Pass** |
| TC-AIS-08 | Resume text missing from upload time | 1. Add a resume whose saved text is empty but whose PDF has "Ana Reyes / SKILLS: JavaScript, SQL"<br>2. POST `{ application_id }` | Text is read from the stored PDF, sent to Gemini, and saved on the resume; HTTP 200 | Text read from the PDF, sent, and saved; HTTP 200 | **Pass** |
| TC-AIS-09 | Resume has no readable text (e.g. a scanned image) | 1. Add a resume with no extractable text<br>2. POST `{ application_id }` | HTTP 422, reason "No readable text was found in the resume..."; Gemini not called | HTTP 422 with that reason; Gemini not called | **Pass** |
| TC-AIS-10 | Application without a resume | 1. Add an application with no resume<br>2. POST `{ application_id }` | HTTP 400 "Upload a resume before screening." | HTTP 400 with that message | **Pass** |
| TC-AIS-11 | Unknown application / no screening yet | 1. POST `application_id` 999999999<br>2. GET `/api/ai-screenings/:id` for an unscreened application | HTTP 404 for both | HTTP 404 for both | **Pass** |
| TC-AIS-12 | Invalid body | 1. POST `{ "application_id": "abc" }` | HTTP 400 "Some fields are invalid." | HTTP 400 "Some fields are invalid." | **Pass** |
| TC-AIS-13 | Signed-in staff only | 1. POST and GET with no token | HTTP 401 for both | HTTP 401 for both | **Pass** |

## Gemini client retries

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-GEM-01 | Busy status is retried | 1. Gemini answers 429, 500, or 503 once, then succeeds | Retried automatically; answer returned after 2 calls | Answer returned after 2 calls for 429, 500, and 503 | **Pass** |
| TC-GEM-02 | Network failure or timeout is retried | 1. First call times out, second succeeds | Answer returned | Answer returned | **Pass** |
| TC-GEM-03 | Gives up after the last retry | 1. Gemini answers 503 every time | Fails as BUSY after 3 calls (waits of 2 s, then 5 s) | BUSY after 3 calls | **Pass** |
| TC-GEM-04 | Daily quota is not retried | 1. Gemini answers 429 with a `...PerDay...` quota message | Fails as DAILY_LIMIT after 1 call | DAILY_LIMIT after 1 call | **Pass** |
| TC-GEM-05 | Refused request is not retried | 1. Gemini answers 400 "API key not valid" | Fails as REJECTED after 1 call | REJECTED after 1 call | **Pass** |
| TC-GEM-06 | No API key | 1. Leave `GEMINI_API_KEY` empty<br>2. Run a screening | Fails as NOT_CONFIGURED without calling Gemini | NOT_CONFIGURED; Gemini not called | **Pass** |
| TC-GEM-07 | Gemini gives no answer | 1. Gemini returns no text (e.g. a blocked prompt) | Fails as NO_ANSWER | NO_ANSWER | **Pass** |

## Queue, scoring, and failure messages

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-QUE-01 | Screenings run one at a time, in order | 1. Queue a slow task, then a second task | Second waits until the first finishes; queue size 2, then 0 | Ran in order; size 2, then 0 | **Pass** |
| TC-QUE-02 | One failure doesn't block the queue | 1. Queue a task that fails, then another | First fails; next still runs | First failed; next returned its result | **Pass** |
| TC-RES-01 | Fit score formula | 1. Score met / partial / missing | Met = 1, partial = 0.5, missing = 0; result 50 | 50 | **Pass** |
| TC-RES-02 | Rounding and empty list | 1. Score 2 of 3 met<br>2. Score no requirements | 67; 0 | 67; 0 | **Pass** |
| TC-RES-03 | Reply is cleaned up | 1. Reply out of order, in a code fence, with extra whitespace and very long text | Requirements put back in posting order; code fence accepted; whitespace tidied; evidence cut to 300 and explanation to 1,000 characters | All as expected | **Pass** |
| TC-RES-04 | Bad replies are rejected | 1. Send replies that aren't JSON, have no or too few requirements, an unknown match value, a repeated or out-of-range number, or a blank explanation | Each rejected as an unusable answer | All rejected | **Pass** |
| TC-FAIL-01 | Each failure gets a clear message | 1. Map BUSY, an unusable answer, and missing resume text to messages<br>2. Pass any other error | Matching recruiter-facing message for each; other errors (bugs, database) are not saved as failed screenings | Messages match; other errors left alone | **Pass** |
