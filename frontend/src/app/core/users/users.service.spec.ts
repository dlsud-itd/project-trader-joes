import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { User, UserRole } from '../auth/auth.models';
import { UsersService } from './users.service';

const USERS_URL = `${environment.apiUrl}/users`;

const recruiter: User = {
  id: 2,
  email: 'recruiter@talentflow.dev',
  first_name: 'Rey',
  last_name: 'Cruz',
  role: UserRole.RECRUITER,
  created_at: '2026-10-16T00:00:00Z',
};

describe('UsersService', () => {
  let service: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists every account', () => {
    let result: User[] = [];
    service.list().subscribe((list: User[]) => (result = list));

    const req = http.expectOne(USERS_URL);
    expect(req.request.method).toBe('GET');
    req.flush([recruiter]);

    expect(result).toEqual([recruiter]);
  });
});
