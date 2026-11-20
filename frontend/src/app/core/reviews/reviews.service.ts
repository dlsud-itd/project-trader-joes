import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Note,
  NoteResponse,
  RatingResponse,
  RatingSummary,
} from './reviews.models';

/**
 * Notes and star ratings on one application. Staff can read them;
 * managers and recruiters assigned to the posting can add them.
 */
@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/applications`;

  /** Every note, newest first. */
  listNotes(applicationId: number): Observable<Note[]> {
    return this.http.get<Note[]>(`${this.api}/${applicationId}/notes`);
  }

  /** Adds a note signed by you. */
  addNote(applicationId: number, body: string): Observable<Note> {
    return this.http
      .post<NoteResponse>(`${this.api}/${applicationId}/notes`, { body })
      .pipe(map((res: NoteResponse) => res.note));
  }

  /** Deletes a note: your own, or any note if you are a manager. */
  deleteNote(applicationId: number, noteId: number): Observable<void> {
    return this.http
      .delete<{ message: string }>(
        `${this.api}/${applicationId}/notes/${noteId}`,
      )
      .pipe(map(() => undefined));
  }

  /** The average, how many rated, your rating, and whether you can rate. */
  getRating(applicationId: number): Observable<RatingSummary> {
    return this.http.get<RatingSummary>(`${this.api}/${applicationId}/rating`);
  }

  /** Sets or changes your rating. */
  setRating(applicationId: number, rating: number): Observable<RatingSummary> {
    return this.http
      .put<RatingResponse>(`${this.api}/${applicationId}/rating`, { rating })
      .pipe(map((res: RatingResponse) => res.rating));
  }

  /** Removes your rating. */
  removeRating(applicationId: number): Observable<RatingSummary> {
    return this.http
      .delete<RatingResponse>(`${this.api}/${applicationId}/rating`)
      .pipe(map((res: RatingResponse) => res.rating));
  }
}
