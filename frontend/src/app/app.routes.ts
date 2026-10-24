import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { unsavedChangesGuard } from './core/job-postings';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · TalentFlow',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
    {
    // Public pages for applicants. No sign-in needed.
    path: 'careers',
    loadComponent: () =>
      import('./layout/public-shell').then((m) => m.PublicShell),
    children: [
      {
        path: '',
        title: 'Careers · TalentFlow',
        loadComponent: () =>
          import('./pages/careers/careers').then((m) => m.Careers),
      },
      {
        path: ':id',
        title: 'Careers · TalentFlow',
        loadComponent: () =>
          import('./pages/career-detail/career-detail').then(
            (m) => m.CareerDetail,
          ),
      },
    ],
  },
  {
    // Everything inside the shell requires a signed-in user.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · TalentFlow',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'postings',
        title: 'Job postings · TalentFlow',
        loadComponent: () =>
          import('./pages/postings/postings').then((m) => m.Postings),
      },
      {
        path: 'postings/new',
        title: 'New job posting · TalentFlow',
        canActivate: [roleGuard('manager')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/posting-form/posting-form').then(
            (m) => m.PostingForm,
          ),
      },
      {
        path: 'postings/:id/edit',
        title: 'Edit job posting · TalentFlow',
        canActivate: [roleGuard('manager')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./pages/posting-form/posting-form').then(
            (m) => m.PostingForm,
          ),
      },
      {
        path: 'team',
        title: 'Team accounts · TalentFlow',
        canActivate: [roleGuard('manager')],
        loadComponent: () => import('./pages/team/team').then((m) => m.Team),
      },
    ],
  },
  {
    // Public apply form. Kept apart from the careers routes above,
    // so the two can be added in either order.
    path: 'careers/:id/apply',
    loadComponent: () =>
      import('./layout/public-shell').then((m) => m.PublicShell),
    children: [
      {
        path: '',
        title: 'Apply · TalentFlow',
        loadComponent: () => import('./pages/apply/apply').then((m) => m.Apply),
      },
    ],
  },
  {
    path: '**',
    title: 'Page not found · TalentFlow',
    loadComponent: () =>
      import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
