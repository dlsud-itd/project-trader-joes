import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Note, RatingSummary } from './reviews.models';
import { ReviewsService } from './reviews.service';

const API = `${environment.apiUrl}/applications/101`;

const NOTE: Note = {
  id: 1,
  application_id: 101,
  body: 'Strong portfolio.',
  created_at: '2026-11-14T12:00:00Z',
  author: { id: 1, first_name: 'Maria', last_name: 'Santos' },
};

const SUMMARY: RatingSummary = {
  average: 4,
  count: 1,
  my_rating: 4,
  can_review: true,
};

describe('ReviewsService', () => {
  let service: ReviewsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReviewsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and adds notes', () => {
    let notes: Note[] = [];
    service.listNotes(101).subscribe((n) => (notes = n));
    http.expectOne(`${API}/notes`).flush([NOTE]);
    expect(notes).toEqual([NOTE]);

    let added: Note | null = null;
    service.addNote(101, 'Strong portfolio.').subscribe((n) => (added = n));
    const req = http.expectOne(`${API}/notes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'Strong portfolio.' });
    req.flush({ message: 'Note added.', note: NOTE });
    expect(added).toEqual(NOTE);
  });

  it('gets, sets, and removes your rating', () => {
    let got: RatingSummary | null = null;
    service.getRating(101).subscribe((s) => (got = s));
    http.expectOne(`${API}/rating`).flush(SUMMARY);
    expect(got).toEqual(SUMMARY);

    let saved: RatingSummary | null = null;
    service.setRating(101, 4).subscribe((s) => (saved = s));
    const put = http.expectOne(`${API}/rating`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ rating: 4 });
    put.flush({ message: 'Rating saved.', rating: SUMMARY });
    expect(saved).toEqual(SUMMARY);

    let removed: RatingSummary | null = null;
    service.removeRating(101).subscribe((s) => (removed = s));
    const del = http.expectOne(`${API}/rating`);
    expect(del.request.method).toBe('DELETE');
    const cleared = { ...SUMMARY, average: null, count: 0, my_rating: null };
    del.flush({ message: 'Rating removed.', rating: cleared });
    expect(removed).toEqual(cleared);
  });

  it('deletes a note', () => {
    let done = false;
    service.deleteNote(101, 7).subscribe(() => (done = true));
    const req = http.expectOne(`${API}/notes/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Note deleted.' });
    expect(done).toBe(true);
  });
});
