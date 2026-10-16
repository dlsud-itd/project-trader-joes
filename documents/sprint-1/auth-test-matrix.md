# Authentication Test Matrix - Sprint 1

| Case ID | Test Case Description | Steps | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC-AUTH-01 | Public route accessibility | 1. Access public endpoint (e.g., login) without token | HTTP 200 OK / Success | HTTP 200 OK / Success | **Pass** |
| TC-AUTH-02 | Missing token validation | 1. Request protected endpoint (`/api/auth/me`) with no auth header | HTTP 401 Unauthorized | HTTP 401 Unauthorized | **Pass** |
| TC-AUTH-03 | Valid token authentication | 1. Provide valid Bearer JWT in request header | Guard passes; user attached to `req.user` | Guard passes; user attached to `req.user` | **Pass** |
| TC-AUTH-04 | Database health check | 1. Send GET request to `/api/health` | HTTP 200 with database status up | HTTP 200 with database status up | **Pass** |
| TC-AUTH-05 | User login (Valid) | 1. POST valid manager/recruiter email & password to `/api/auth/login` | HTTP 200 with JWT token and user object | HTTP 200 with JWT token and user object | **Pass** |
| TC-AUTH-06 | User login (Invalid) | 1. POST incorrect password to `/api/auth/login` | HTTP 401 Unauthorized error message | HTTP 401 Unauthorized error message | **Pass** |
| TC-AUTH-07 | Role-based restriction (Recruiter) | 1. Authenticate as recruiter<br>2. Attempt to POST to `/api/auth/register` | HTTP 403 Forbidden | HTTP 403 Forbidden | **Pass** |
| TC-AUTH-08 | Manager registration validation | 1. Send invalid registration payload (short password, bad email) | HTTP 400 Bad Request with details | HTTP 400 Bad Request with details | **Pass** |
| TC-AUTH-09 | Manager user registration (Success) | 1. Authenticate as manager<br>2. POST unique new user data to `/api/auth/register` | HTTP 201 Created with user object | HTTP 201 Created with user object | **Pass** |
| TC-AUTH-10 | Duplicate email conflict handling | 1. Attempt to register with an email that already exists | HTTP 409 Conflict | HTTP 409 Conflict | **Pass** |