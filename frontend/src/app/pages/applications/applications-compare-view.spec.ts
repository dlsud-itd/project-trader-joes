import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { Applications } from './applications';
import { TEST_APPLICATIONS } from './test-applications';

const LIST_URL = `${environment.apiUrl}/applications`;

@Component({ template: '' })
class ProfileStub {}

describe('Applications compare view', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  const el = () => harness.routeNativeElement as HTMLElement;
  // Spaces collapsed, since headings wrap across lines in the template.
  const text = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const tick = (name: string): HTMLInputElement =>
    el().querySelector<HTMLInputElement>(
      `input.pick[aria-label="Compare ${name}"]`,
    ) as HTMLInputElement;
  const button = (label: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(
      (b: HTMLButtonElement) => b.textContent?.trim().startsWith(label),
    ) as HTMLButtonElement;
  const columns = (): string[] =>
    Array.from(el().querySelectorAll('.compare thead .who__name')).map(
      (n: Element) => n.textContent?.trim() ?? '',
    );

  async function open(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'applications', component: Applications },
          { path: 'applications/:id', component: ProfileStub },
        ]),
        {
          // Signed in as a manager, who sees every applicant.
          provide: AuthService,
          useValue: {
            hasRole: (...roles: UserRole[]) => roles.includes(UserRole.MANAGER),
            user: signal({ id: 1, role: UserRole.MANAGER }),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    http.expectOne(LIST_URL).flush(structuredClone(TEST_APPLICATIONS));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function pick(name: string) {
    tick(name).click();
    harness.detectChanges();
  }

  afterEach(() => http.verify());

  it('shows a selection bar once applicants are ticked', async () => {
    await open('/applications');
    expect(el().querySelector('.picks')).toBeNull();

    pick('Mei-Lin Chen');
    expect(text()).toContain('1 selected');
    expect(text()).toContain('for Frontend Developer Intern');
    expect(button('Compare 1').disabled).toBe(true);

    pick('Jonah Reyes');
    expect(button('Compare 2').disabled).toBe(false);
  });

  it('only lets you tick applicants for the same job', async () => {
    await open('/applications');
    pick('Mei-Lin Chen');

    // Kenji applied to QA Analyst, not Frontend Developer Intern.
    expect(tick('Kenji Watanabe').disabled).toBe(true);
    expect(tick('Kenji Watanabe').title).toBe(
      'Compare applicants who applied to the same job',
    );
    expect(tick('Jonah Reyes').disabled).toBe(false);

    // Unticking the first applicant frees up every job again.
    pick('Mei-Lin Chen');
    expect(tick('Kenji Watanabe').disabled).toBe(false);
  });

  it('opens the ticked applicants side by side for their job', async () => {
    await open('/applications');
    pick('Kenji Watanabe');
    pick('Sofia Alvarez');
    button('Compare 2').click();
    await settle();

    expect(router.url).toBe('/applications?compare=106,107');
    expect(columns()).toEqual(['Kenji Watanabe', 'Sofia Alvarez']);
    expect(el().querySelector('app-search-toolbar')).toBeNull();
    expect(text()).toContain('Comparing 2 applicants for QA Analyst');
    expect(text()).toContain('Requirements for QA Analyst');
    expect(text()).toContain('CI pipelines');
  });

  it('goes back to the list with the same applicants still ticked', async () => {
    await open('/applications?compare=101,103');
    expect(columns()).toEqual(['Mei-Lin Chen', 'Aisha Rahman']);
    expect(text()).toContain('Highest fit');

    button('← Back to list').click();
    await settle();
    expect(router.url).toBe('/applications');
    expect(el().querySelector('.list__head')).not.toBeNull();
    expect(tick('Mei-Lin Chen').checked).toBe(true);
    expect(tick('Aisha Rahman').checked).toBe(true);
  });

  it('allows at most four applicants', async () => {
    await open('/applications');
    for (const name of [
      'Mei-Lin Chen',
      'Jonah Reyes',
      'Aisha Rahman',
      'Lucas Martin',
    ]) {
      pick(name);
    }
    expect(text()).toContain('the most you can compare');
    expect(tick('Hana Kim').disabled).toBe(true);
    expect(tick('Hana Kim').title).toBe('You can compare up to 4 applicants');
    expect(tick('Mei-Lin Chen').disabled).toBe(false);
  });

  it('removes an applicant while more than two are compared', async () => {
    await open('/applications?compare=101,102,103');
    el()
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Jonah Reyes from compare"]',
      )
      ?.click();
    await settle();

    expect(router.url).toBe('/applications?compare=101,103');
    expect(columns()).toEqual(['Mei-Lin Chen', 'Aisha Rahman']);
    expect(el().querySelector('.remove')).toBeNull();
  });

  it('warns when a link mixes jobs and names no best fit', async () => {
    await open('/applications?compare=101,106');
    expect(columns()).toEqual(['Mei-Lin Chen', 'Kenji Watanabe']);
    expect(text()).toContain('applied to different jobs');
    expect(text()).toContain('Frontend Developer Intern, QA Analyst');
    expect(text()).not.toContain('Highest fit');
    expect(text()).not.toContain('Comparing 2 applicants for');
  });

  it('asks for two applicants when the link has fewer', async () => {
    await open('/applications?compare=101,99999');
    expect(text()).toContain('Pick at least two applicants to compare.');
    button('Back to list').click();
    await settle();
    expect(router.url).toBe('/applications');
  });
});
