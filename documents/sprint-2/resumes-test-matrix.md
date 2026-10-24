# Resume Upload Test Matrix - Sprint 2

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-RES-01 | Upload a PDF resume | 1. Apply to an open posting<br>2. POST the PDF to `/api/resumes` with `application_id` and `upload_token` | HTTP 201 with `resume.file_url`, no file bytes in the response | HTTP 201 with `resume.file_url` (`/api/resumes/:id/file`), `mime_type` `application/pdf`; no `data` field in the response | **Pass** |
| TC-RES-02 | Upload a Word (.docx) resume | 1. Same as TC-RES-01 with a .docx file | HTTP 201, `mime_type` is the Word type | HTTP 201, `mime_type` is `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | **Pass** |
| TC-RES-03 | Fake PDF is rejected | 1. Rename a .txt file to resume.pdf<br>2. Upload it | HTTP 400 "Upload a PDF or Word (.docx) file." | HTTP 400 "Upload a PDF or Word (.docx) file." | **Pass** |
| TC-RES-04 | File over 5 MB is rejected | 1. Upload a PDF larger than 5 MB | HTTP 413 | HTTP 413 | **Pass** |
| TC-RES-05 | Missing file | 1. POST only `application_id` and `upload_token` | HTTP 400 "Invalid or missing resume document." | HTTP 400 "Invalid or missing resume document." | **Pass** |
| TC-RES-06 | Token from another application | 1. Apply twice<br>2. Upload to the second application with the first token | HTTP 403 "This upload link is not valid." | HTTP 403 "This upload link is not valid." | **Pass** |
| TC-RES-07 | Second upload for the same application | 1. Upload a resume<br>2. Upload again with the same id and token | HTTP 409 | HTTP 409 | **Pass** |
| TC-RES-08 | Staff download | 1. Sign in as manager<br>2. GET the `file_url` | HTTP 200, same file, correct file name | HTTP 200, bytes identical to the upload, `Content-Type: application/pdf`, `Content-Disposition` has the original file name | **Pass** |
| TC-RES-09 | Download without sign-in | 1. GET the `file_url` with no token | HTTP 401 | HTTP 401 | **Pass** |
| TC-RES-10 | Unknown resume id | 1. Sign in<br>2. GET `/api/resumes/999999/file` | HTTP 404 "Resume not found." | HTTP 404 "Resume not found." | **Pass** |
