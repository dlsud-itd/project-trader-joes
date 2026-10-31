import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { UserRole } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';

/**
 * Layout for public pages (careers, apply): logo, applicant and staff
 * sign-in, and the page.
 */
@Component({
  selector: 'app-public-shell',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './public-shell.html',
  styleUrl: './public-shell.scss',
})
export class PublicShell implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly UserRole = UserRole;
  protected readonly year = new Date().getFullYear();

  protected readonly initials = computed(() => {
    const u = this.auth.user();
    return u
      ? `${u.first_name[0] ?? ''}${u.last_name[0] ?? ''}`.toUpperCase()
      : '';
  });

  /**
   * Nothing here requires sign-in, so restore the session just to show the
   * right header links.
   */
  ngOnInit(): void {
    this.auth.restoreSession().subscribe();
  }
}
