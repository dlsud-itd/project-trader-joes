# Careers and Apply Test Matrix - Sprint 2

Run these in the browser at `http://localhost:4200` while signed out, unless a step says
otherwise. Fill in **Actual Result** and **Pass/Fail**. Repeat the cases marked (phone) at 390
px wide (DevTools device toolbar).

| Case ID   | Test Case Description           | Steps                                                                                  | Expected Result                                                                | Actual Result | Pass/Fail |
| :-------- | :------------------------------ | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :------------ | :-------- |
| TC-CAR-01 | Careers page lists open roles   | 1. As manager, create one open and one closed posting<br>2. Sign out, open `/careers`  | Only the open posting is listed                                                |               |           |
| TC-CAR-02 | Search                          | 1. Type part of a title or location in the search box                                  | Only matching roles stay; "No roles match." with Clear filters when none match |               |           |
| TC-CAR-03 | Department filter               | 1. Have postings in two departments<br>2. Click a department chip, then click it again | List filters, then shows everything again                                      |               |           |
| TC-CAR-04 | Role page                       | 1. Click a role                                                                        | Title, description, every requirement, and Apply now                           |               |           |
| TC-CAR-05 | Closed role link                | 1. Open `/careers/<id>` of a closed posting                                            | "This role is no longer available"                                             |               |           |
| TC-CAR-06 | Signed-in staff on careers page | 1. Sign in as manager<br>2. Open `/careers`                                            | Closed postings still don't show                                               |               |           |
| TC-APP-01 | Required fields                 | 1. Open Apply now<br>2. Click Submit application with an empty form                    | Errors for name, email, and resume; nothing is sent                            |               |           |
| TC-APP-02 | Optional field checks           | 1. Type "call me" as phone and "github.com/me" as link<br>2. Submit                    | Phone and link errors                                                          |               |           |
| TC-APP-03 | Wrong resume type               | 1. Choose a .png or .doc file                                                          | "Choose a PDF or Word (.docx) file." and the file is not kept                  |               |           |
| TC-APP-04 | Resume over 5 MB                | 1. Choose a PDF over 5 MB                                                              | "The resume must be 5 MB or smaller."                                          |               |           |
| TC-APP-05 | Drag and drop                   | 1. Drag a PDF onto the resume box                                                      | File name and size are shown, with Remove                                      |               |           |
| TC-APP-06 | Successful application          | 1. Fill in name, email, resume<br>2. Submit                                            | "Application sent" with the email shown                                        |               |           |
| TC-APP-07 | Same email twice                | 1. Apply again to the same role with the same email                                    | "You have already applied for this position with this email."                  |               |           |
| TC-APP-08 | Careers and apply pages (phone) | 1. Repeat TC-CAR-01, TC-CAR-04, and TC-APP-06 at 390 px                                | Nothing cut off; no sideways scrolling                                         |               |           |
| TC-APP-09 | Sign-in page link               | 1. Sign out<br>2. On the sign-in page click "See open roles"                           | Goes to `/careers`                                                             |               |           |
