import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { environment } from '../../../environments/environment';
import { ApplicationRow, KanbanStage } from '../../core/applications';
import { AuthService } from '../../core/auth/auth.service';
import { Applications, moveFailedMessage } from './applications';
import { TEST_APPLICATIONS } from './test-applications';

const LIST_URL = `${environment.apiUrl}/applications`;
const stageUrl = (id: number) => `${LIST_URL}/${id}/stage`;

const byName = (name: string): ApplicationRow =>
  TEST_APPLICATIONS.find(
    (r: ApplicationRow) => r.full_name === name,
  ) as ApplicationRow;

/** The real `/pipeline` route from app.routes.ts. */
const pipelineRoute = routes
  .flatMap((r: Route) => r.children ?? [])
  .find((r: Route) => r.path === 'pipeline') as Route;

@Component({ template: '' })
class ProfileStub {}

describe('Applications board view', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  const el = () => harness.routeNativeElement as HTMLElement;
  const cardNames = (root: Element): (string | undefined)[] =>
    Array.from(root.querySelectorAll('.card__name')).map((n: Element) =>
      n.textContent?.trim(),
    );
  const columnOf = (name: string): string | undefined =>
    Array.from(el().querySelectorAll('.column'))
      .find((c: Element) => cardNames(c).includes(name))
      ?.querySelector('.column__head .tf-stage')
      ?.textContent?.trim();
  const viewButton = (label: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.views__btn')).find(
      (b: HTMLButtonElement) => b.textContent?.includes(label),
    ) as HTMLButtonElement;
  const moveSelect = (name: string): HTMLSelectElement =>
    el().querySelector<HTMLSelectElement>(
      `.card__move[aria-label="Stage for ${name}"]`,
    ) as HTMLSelectElement;

  async function open(url: string, isManager: boolean = true) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          pipelineRoute,
          { path: 'applications', component: Applications },
          { path: 'applications/:id', component: ProfileStub },
        ]),
        { provide: AuthService, useValue: { hasRole: () => isManager } },
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

  /** Picks a new stage from the card's menu, as a manager would. */
  function moveWithMenu(name: string, stage: KanbanStage) {
    const select = moveSelect(name);
    select.value = stage;
    select.dispatchEvent(new Event('change'));
    harness.detectChanges();
  }

  afterEach(() => http.verify());

  it('opens the board from ?view=board', async () => {
    await open('/applications?view=board');
    expect(el().querySelectorAll('.column').length).toBe(5);
    expect(el().querySelector('.list__head')).toBeNull();
    expect(viewButton('Board').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the list when there is no view in the URL', async () => {
    await open('/applications');
    expect(el().querySelector('.list__head')).not.toBeNull();
    expect(el().querySelector('.column')).toBeNull();
    expect(viewButton('List').getAttribute('aria-pressed')).toBe('true');
  });

  it('switches views and keeps the choice in the URL', async () => {
    await open('/applications');
    viewButton('Board').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/applications?view=board');
    expect(el().querySelectorAll('.column').length).toBe(5);

    viewButton('List').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/applications');
  });

  it('applies the same posting filter and quick filters', async () => {
    await open('/applications?view=board');
    const posting = el().querySelector<HTMLSelectElement>(
      '.select select',
    ) as HTMLSelectElement;
    posting.value = 'QA Analyst';
    posting.dispatchEvent(new Event('change'));
    harness.detectChanges();

    expect(cardNames(el()).sort()).toEqual([
      'Daniel Okafor',
      'Kenji Watanabe',
      'Sofia Alvarez',
    ]);
  });

  it('moves the card at once and saves the stage', async () => {
    await open('/applications?view=board');
    const aisha = byName('Aisha Rahman');
    moveWithMenu('Aisha Rahman', KanbanStage.OFFER);

    // Moved before the server answers, and locked while saving.
    expect(columnOf('Aisha Rahman')).toBe(KanbanStage.OFFER);
    expect(moveSelect('Aisha Rahman').disabled).toBe(true);

    const req = http.expectOne(stageUrl(aisha.id));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ kanban_stage: 'Offer' });
    req.flush({
      message: 'Application stage updated successfully.',
      application: {
        id: aisha.id,
        kanban_stage: 'Offer',
        updated_at: '2026-11-06T03:00:00Z',
      },
    });
    harness.detectChanges();

    expect(columnOf('Aisha Rahman')).toBe(KanbanStage.OFFER);
    expect(moveSelect('Aisha Rahman').disabled).toBe(false);
    expect(el().querySelector('.tf-alert--error')).toBeNull();
  });

  it('moves the card back and explains when saving fails', async () => {
    await open('/applications?view=board');
    const aisha = byName('Aisha Rahman');
    moveWithMenu('Aisha Rahman', KanbanStage.OFFER);

    http
      .expectOne(stageUrl(aisha.id))
      .flush(null, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(columnOf('Aisha Rahman')).toBe(KanbanStage.INTERVIEW);
    expect(moveSelect('Aisha Rahman').value).toBe(KanbanStage.INTERVIEW);
    expect(el().querySelector('.tf-alert--error')?.textContent).toContain(
      moveFailedMessage({ row: aisha, stage: KanbanStage.OFFER }),
    );
  });

  it('shows the server message when the move is refused', async () => {
    await open('/applications?view=board');
    const aisha = byName('Aisha Rahman');
    moveWithMenu('Aisha Rahman', KanbanStage.OFFER);

    http
      .expectOne(stageUrl(aisha.id))
      .flush(
        { error: 'You do not have permission to do that.' },
        { status: 403, statusText: 'Forbidden' },
      );
    harness.detectChanges();

    expect(columnOf('Aisha Rahman')).toBe(KanbanStage.INTERVIEW);
    expect(el().querySelector('.tf-alert--error')?.textContent).toContain(
      'You do not have permission to do that.',
    );
  });

  it('keeps the board read-only for recruiters', async () => {
    await open('/applications?view=board', false);
    expect(el().querySelectorAll('.column').length).toBe(5);
    expect(el().querySelector('.card__move')).toBeNull();
    expect(el().querySelector('.head')?.textContent).not.toContain('Drag');
  });

  it('sends /pipeline to the board view', async () => {
    await open('/pipeline');
    expect(router.url).toBe('/applications?view=board');
    expect(el().querySelectorAll('.column').length).toBe(5);
  });
});
