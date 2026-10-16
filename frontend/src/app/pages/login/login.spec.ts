import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Login } from './login';

describe('Login page', () => {
  let fixture: ComponentFixture<Login>;
  let page: Login;
  let http: HttpTestingController;

  const loginUrl = `${environment.apiUrl}/auth/login`;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'dashboard', children: [] }]),
      ],
    });
    fixture = TestBed.createComponent(Login);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  function find(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  it('shows an error for an invalid email', () => {
    page.form.controls.email.setValue('not-an-email');
    page.form.controls.email.markAsTouched();
    fixture.detectChanges();

    expect(find('.tf-error')?.textContent).toContain('Enter a valid email address.');
  });

  it('disables the button while signing in', async () => {
    page.form.setValue({ email: 'manager@talentflow.dev', password: 'Manager123!' });
    const done = page.submit();
    fixture.detectChanges();

    const button = find('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    http.expectOne(loginUrl).flush({
      token: 'abc',
      user: { id: 1, email: 'manager@talentflow.dev', first_name: 'A', last_name: 'B', role: 'manager' },
    });
    await done;
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
  });

  it('does not send anything when the form is empty', async () => {
    await page.submit();

    http.expectNone(loginUrl);
    expect(page.submitting()).toBe(false);
  });
});