import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { unsavedChangesGuard } from './core/job-postings/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · TalentFlow',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
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
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'postings',
        title: 'Job postings · TalentFlow',
        loadComponent: () => import('./pages/postings/postings').then((m) => m.Postings),
      },
      {
        path: 'postings/new',
        title: 'New job posting · TalentFlow',
        canActivate: [roleGuard('manager')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./pages/posting-form/posting-form').then((m) => m.PostingForm),
      },
      {
        path: 'postings/:id/edit',
        title: 'Edit job posting · TalentFlow',
        canActivate: [roleGuard('manager')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./pages/posting-form/posting-form').then((m) => m.PostingForm),
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
    path: '**',
    title: 'Page not found · TalentFlow',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];