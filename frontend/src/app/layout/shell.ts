import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Event,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { ROLE_LABELS, UserRole } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';

/**
 * Layout for signed-in pages: a sidebar with the navigation and account,
 * and the page content beside it. On small screens the sidebar becomes a
 * drawer opened from the top bar.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: {
    '(document:keydown.escape)': 'isMenuOpen.set(false)',
  },
})
export class Shell {
  protected readonly auth = inject(AuthService);

  protected readonly UserRole = UserRole;

  /** Drawer state on small screens. */
  protected readonly isMenuOpen = signal(false);

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    return user
      ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
      : '';
  });

  protected readonly roleLabel = computed(() => {
    const role = this.auth.user()?.role;
    return role ? ROLE_LABELS[role] : '';
  });

  constructor() {
    // Close the drawer after picking a page.
    inject(Router)
      .events.pipe(
        filter((event: Event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.isMenuOpen.set(false));
  }
}
