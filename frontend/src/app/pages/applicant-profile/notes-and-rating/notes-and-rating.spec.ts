import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { User, UserRole } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { Note, RatingAverage, RatingSummary } from '../../../core/reviews';
import { NotesAndRating } from './notes-and-rating';

const API = `${environment.apiUrl}/applications/101`;

const ME: User = {
  id: 2,
  email: 'recruiter@talentflow.dev',
  first_name: 'Juan',
  last_name: 'Reyes',
  role: UserRole.RECRUITER,
  created_at: '2026-10-01T00:00:00Z',
};

const OLD_NOTE: Note = {
  id: 1,
  application_id: 101,
  body: 'Strong portfolio.',
  created_at: '2026-10-21T02:10:00Z',
  author: { id: 1, first_name: 'Maria', last_name: 'Santos' },
};

const SUMMARY: RatingSummary = {
  average: 4,
  count: 1,
  my_rating: null,
  can_review: true,
};

describe('NotesAndRating', () => {
  let fixture: ComponentFixture<NotesAndRating>;
  let http: HttpTestingController;
  let averages: RatingAverage[];

  const el = () => fixture.nativeElement as HTMLElement;
  /** The card's text with line breaks and indents collapsed. */
  const text = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const textarea = () =>
    el().querySelector<HTMLTextAreaElement>('textarea') as HTMLTextAreaElement;
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label),
    ) as HTMLButtonElement;
  const noteBodies = () =>
    Array.from(el().querySelectorAll('.note__body')).map((p) =>
      p.textContent?.trim(),
    );
  const type = (value: string) => {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  /** Submits the note form (a click can't submit a detached form). */
  const postNote = () => {
    el().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const star = (n: number) =>
    el().querySelectorAll<HTMLInputElement>('input[type=radio]')[n - 1];

  /** Opens the card and answers its two requests. */
  function render(notes: Note[] = [OLD_NOTE], summary = SUMMARY) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: signal(ME) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotesAndRating);
    averages = [];
    fixture.componentInstance.ratingChange.subscribe((r: RatingAverage) =>
      averages.push(r),
    );
    fixture.componentRef.setInput('applicationId', 101);
    fixture.detectChanges();
    http.expectOne(`${API}/notes`).flush(notes);
    http.expectOne(`${API}/rating`).flush(summary);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  describe('reading', () => {
    it('lists notes with the author and the full date on hover', () => {
      render();
      expect(text()).toContain('Maria Santos');
      expect(noteBodies()).toEqual(['Strong portfolio.']);
      const time = el().querySelector('time') as HTMLTimeElement;
      expect(time.getAttribute('datetime')).toBe(OLD_NOTE.created_at);
      expect(time.title).toContain('Oct 21, 2026');
    });

    it('shows the team rating', () => {
      render();
      expect(el().querySelector('app-rating-average')?.textContent).toContain(
        '4.0',
      );
    });

    it('says when there are no notes yet', () => {
      render([]);
      expect(text()).toContain('No notes yet. Be the first to add one.');
    });

    it('is read-only for staff who cannot review this applicant', () => {
      render([OLD_NOTE], { ...SUMMARY, can_review: false });
      expect(el().querySelector('textarea')).toBeNull();
      expect(el().querySelector('app-star-rating')).toBeNull();
      expect(text()).toContain(
        'Only managers and recruiters assigned to this posting',
      );
      expect(noteBodies()).toEqual(['Strong portfolio.']);
    });

    it('offers a retry when loading fails', () => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: AuthService, useValue: { user: signal(ME) } },
        ],
      });
      http = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(NotesAndRating);
      fixture.componentRef.setInput('applicationId', 101);
      fixture.detectChanges();
      http
        .expectOne(`${API}/notes`)
        .flush(null, { status: 500, statusText: 'Error' });
      http.match(`${API}/rating`);
      fixture.detectChanges();
      expect(text()).toContain('Could not load notes and ratings.');

      button('Try again').click();
      http.expectOne(`${API}/notes`).flush([]);
      http.expectOne(`${API}/rating`).flush(SUMMARY);
      fixture.detectChanges();
      expect(text()).toContain('No notes yet');
    });
  });

  describe('posting a note', () => {
    it('shows the note at once, then the saved one', () => {
      render();
      type('  Booked an interview.  ');
      postNote();

      expect(noteBodies()).toEqual([
        'Booked an interview.',
        'Strong portfolio.',
      ]);
      expect(text()).toContain('Posting…');
      expect(textarea().value).toBe('');

      const req = http.expectOne(`${API}/notes`);
      expect(req.request.body).toEqual({ body: 'Booked an interview.' });
      req.flush({
        message: 'Note added.',
        note: {
          ...OLD_NOTE,
          id: 2,
          body: 'Booked an interview.',
          created_at: new Date().toISOString(),
          author: { id: ME.id, first_name: 'Juan', last_name: 'Reyes' },
        },
      });
      fixture.detectChanges();
      expect(text()).not.toContain('Posting…');
      expect(text()).toContain('Juan Reyes (you)');
      expect(text()).toContain('just now');
    });

    it('takes the note back out and keeps the text if saving fails', () => {
      render();
      type('Will this save?');
      postNote();
      http.expectOne(`${API}/notes`).flush(
        {
          error: 'Only managers and recruiters assigned can add notes.',
        },
        { status: 403, statusText: 'Forbidden' },
      );
      fixture.detectChanges();

      expect(noteBodies()).toEqual(['Strong portfolio.']);
      expect(textarea().value).toBe('Will this save?');
      expect(el().querySelector('[role=alert]')?.textContent).toContain(
        'Only managers and recruiters assigned',
      );
    });

    it('posts with Ctrl+Enter', () => {
      render();
      type('Quick note');
      textarea().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
      );
      http
        .expectOne(`${API}/notes`)
        .flush({ message: 'Note added.', note: { ...OLD_NOTE, id: 3 } });
    });

    it('cannot post a blank note, and counts characters', () => {
      render();
      expect(button('Post note').disabled).toBe(true);
      type('   ');
      expect(button('Post note').disabled).toBe(true);
      textarea().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
      );
      http.expectNone(`${API}/notes`);

      type('Hello');
      expect(button('Post note').disabled).toBe(false);
      expect(text()).toContain('5 / 2,000');
      expect(textarea().getAttribute('maxlength')).toBe('2000');
    });
  });

  describe('rating', () => {
    it('updates the stars and the average at once, then saves', () => {
      render();
      star(2).dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(star(2).checked).toBe(true);
      expect(averages.at(-1)).toEqual({ average: 3, count: 2 });

      const req = http.expectOne(`${API}/rating`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ rating: 2 });
      req.flush({
        message: 'Rating saved.',
        rating: { ...SUMMARY, average: 3, count: 2, my_rating: 2 },
      });
      fixture.detectChanges();
      expect(button('Remove')).toBeDefined();
    });

    it('puts the old rating back if saving fails', () => {
      render();
      star(5).dispatchEvent(new Event('change'));
      http
        .expectOne(`${API}/rating`)
        .flush(null, { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      expect(star(5).checked).toBe(false);
      expect(averages.at(-1)).toEqual({ average: 4, count: 1 });
      expect(text()).toContain('Your rating wasn’t saved. Try again.');
    });

    it('removes your rating', () => {
      render([OLD_NOTE], { ...SUMMARY, average: 4.5, count: 2, my_rating: 5 });
      button('Remove').click();
      fixture.detectChanges();
      expect(averages.at(-1)).toEqual({ average: 4, count: 1 });

      const req = http.expectOne(`${API}/rating`);
      expect(req.request.method).toBe('DELETE');
      req.flush({
        message: 'Rating removed.',
        rating: { ...SUMMARY, my_rating: null },
      });
      fixture.detectChanges();
      expect(button('Remove')).toBeUndefined();
    });
  });
});
