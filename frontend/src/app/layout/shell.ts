import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { ROLE_LABELS } from '../core/auth/auth.models';
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
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
})
export class Shell {
  protected readonly auth = inject(AuthService);

  /** Drawer state on small screens. */
  protected readonly menuOpen = signal(false);

  protected readonly initials = computed(() => {
    const u = this.auth.user();
    return u
      ? `${u.first_name[0] ?? ''}${u.last_name[0] ?? ''}`.toUpperCase()
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
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }
}
