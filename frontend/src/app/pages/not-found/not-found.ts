import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Shown for any URL that doesn't match a route (the ** route). */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {}
