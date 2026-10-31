import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User } from '../../core/auth/auth.models';
import { ApplicantLogin } from './applicant-login';

const LOGIN_URL = `${environment.apiUrl}/auth/login`;
const VALID_EMAIL = 'applicant@talentflow.dev';
const VALID_PASSWORD = 'Applicant123!';
const FAKE_TOKEN = 'abc';
const EMAIL_ERROR = 'Enter a valid email address.';

const applicant: User = {
  id: 1,
  email: VALID_EMAIL,
  first_name: 'Ana',
  last_name: 'Cruz',
  role: 'applicant',
  created_at: '2026-10-16T00:00:00Z',
};

describe('ApplicantLogin page', () => {
  let fixture: ComponentFixture<ApplicantLogin>;
  let page: ApplicantLogin;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ApplicantLogin],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'careers', children: [] }]),
      ],
    });
    fixture = TestBed.createComponent(ApplicantLogin);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  function findElement(selector: string): HTMLElement {
    return fixture.debugElement.query(By.css(selector)).nativeElement;
  }

  function findSubmitButton(): HTMLButtonElement {
    return findElement('button[type="submit"]') as HTMLButtonElement;
  }

  it('shows an error for an invalid email', () => {
    const email = page.form.controls.email;
    email.setValue('not-an-email');
    email.markAsTouched();
    fixture.detectChanges();

    expect(findElement('.tf-error').textContent).toContain(EMAIL_ERROR);
  });

  it('disables the button while signing in', async () => {
    page.form.setValue({ email: VALID_EMAIL, password: VALID_PASSWORD });
    const signingIn = page.submit();
    fixture.detectChanges();

    expect(findSubmitButton().disabled).toBe(true);

    http.expectOne(LOGIN_URL).flush({ token: FAKE_TOKEN, user: applicant });
    await signingIn;
    fixture.detectChanges();

    expect(findSubmitButton().disabled).toBe(false);
  });

  it('does not send anything when the form is empty', async () => {
    await page.submit();

    http.expectNone(LOGIN_URL);
    expect(page.submitting()).toBe(false);
  });
});
