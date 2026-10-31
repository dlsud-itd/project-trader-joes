import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User, UserRole } from '../../core/auth/auth.models';
import { ApplicantRegister } from './applicant-register';

const REGISTER_URL = `${environment.apiUrl}/auth/register-applicant`;
const LOGIN_URL = `${environment.apiUrl}/auth/login`;
const VALID = {
  first_name: 'Ana',
  last_name: 'Cruz',
  email: 'ana@example.com',
  password: 'Password123',
};
const FAKE_TOKEN = 'abc';

const applicant: User = {
  id: 1,
  email: VALID.email,
  first_name: VALID.first_name,
  last_name: VALID.last_name,
  role: UserRole.APPLICANT,
  created_at: '2026-10-16T00:00:00Z',
};

describe('ApplicantRegister page', () => {
  let fixture: ComponentFixture<ApplicantRegister>;
  let page: ApplicantRegister;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ApplicantRegister],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'careers', children: [] }]),
      ],
    });
    fixture = TestBed.createComponent(ApplicantRegister);
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

  it('shows an error for a weak password', () => {
    const password = page.form.controls.password;
    password.setValue('short');
    password.markAsTouched();
    fixture.detectChanges();

    expect(findElement('.tf-error').textContent).toContain('8 characters');
  });

  it('does not send anything when the form is empty', () => {
    page.submit();

    http.expectNone(REGISTER_URL);
    expect(page.submitting()).toBe(false);
  });

  it('registers, signs in, and disables the button while busy', async () => {
    page.form.setValue(VALID);
    page.submit();
    fixture.detectChanges();

    expect(findSubmitButton().disabled).toBe(true);

    http
      .expectOne(REGISTER_URL)
      .flush({ message: 'Account created successfully.', user: applicant });
    // The sign-in request goes out as soon as registration succeeds.
    http.expectOne(LOGIN_URL).flush({ token: FAKE_TOKEN, user: applicant });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(findSubmitButton().disabled).toBe(false);
  });
});
