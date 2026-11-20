import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
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
  const text = () => el().textContent ?? '';
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
        { provide: AuthService, useValue: { hasRole: () => true } },
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
    expect(button('Compare 1').disabled).toBe(true);

    pick('Kenji Watanabe');
    expect(button('Compare 2').disabled).toBe(false);
  });

  it('opens the ticked applicants side by side and keeps them in the URL', async () => {
    await open('/applications');
    pick('Kenji Watanabe');
    pick('Mei-Lin Chen');
    button('Compare 2').click();
    await settle();

    expect(router.url).toBe('/applications?compare=106,101');
    expect(columns()).toEqual(['Kenji Watanabe', 'Mei-Lin Chen']);
    expect(el().querySelector('app-search-toolbar')).toBeNull();
    expect(text()).toContain('Requirements');
    expect(text()).toContain('CI pipelines');
  });

  it('goes back to the list with the same applicants still ticked', async () => {
    await open('/applications?compare=101,102');
    expect(columns()).toEqual(['Mei-Lin Chen', 'Jonah Reyes']);
    expect(text()).toContain('Highest fit');

    button('← Back to list').click();
    await settle();
    expect(router.url).toBe('/applications');
    expect(el().querySelector('.list__head')).not.toBeNull();
    expect(tick('Mei-Lin Chen').checked).toBe(true);
    expect(tick('Jonah Reyes').checked).toBe(true);
  });

  it('allows at most four applicants', async () => {
    await open('/applications');
    for (const name of [
      'Mei-Lin Chen',
      'Jonah Reyes',
      'Aisha Rahman',
      'Kenji Watanabe',
    ]) {
      pick(name);
    }
    expect(text()).toContain('the most you can compare');
    expect(tick('Sofia Alvarez').disabled).toBe(true);
    expect(tick('Mei-Lin Chen').disabled).toBe(false);
  });

  it('removes an applicant while more than two are compared', async () => {
    await open('/applications?compare=101,102,106');
    el()
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Jonah Reyes from compare"]',
      )
      ?.click();
    await settle();

    expect(router.url).toBe('/applications?compare=101,106');
    expect(columns()).toEqual(['Mei-Lin Chen', 'Kenji Watanabe']);
    expect(el().querySelector('.remove')).toBeNull();
  });

  it('asks for two applicants when the link has fewer', async () => {
    await open('/applications?compare=101,99999');
    expect(text()).toContain('Pick at least two applicants to compare.');
    button('Back to list').click();
    await settle();
    expect(router.url).toBe('/applications');
  });
});
