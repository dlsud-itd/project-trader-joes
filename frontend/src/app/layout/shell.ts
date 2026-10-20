import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROLE_LABELS } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';

/** Layout for signed-in pages: top bar, navigation, and the page content. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);

  protected readonly initials = computed(() => {
    const u = this.auth.user();
    return u ? `${u.first_name[0] ?? ''}${u.last_name[0] ?? ''}`.toUpperCase() : '';
  });

  protected readonly roleLabel = computed(() => {
    const role = this.auth.user()?.role;
    return role ? ROLE_LABELS[role] : '';
  });
}
