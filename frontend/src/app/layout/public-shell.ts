import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/** Layout for public pages (careers, apply): logo, staff sign-in, page. */
@Component({
  selector: 'app-public-shell',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './public-shell.html',
  styleUrl: './public-shell.scss',
})
export class PublicShell {
  protected readonly year = new Date().getFullYear();
}
