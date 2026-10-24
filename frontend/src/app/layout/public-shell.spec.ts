import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { PublicShell } from './public-shell';

describe('PublicShell', () => {
  const render = () => {
    TestBed.configureTestingModule({
      imports: [PublicShell],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(PublicShell);
    fixture.detectChanges();
    return fixture;
  };

  it('links the logo to the careers page', () => {
    const logo = render().debugElement.query(By.css('a.logo'))
      .nativeElement as HTMLAnchorElement;
    expect(logo.getAttribute('href')).toBe('/careers');
    expect(logo.textContent).toContain('TalentFlow');
  });

  it('has a staff sign-in link', () => {
    const staff = render().debugElement.query(By.css('a.staff'))
      .nativeElement as HTMLAnchorElement;
    expect(staff.getAttribute('href')).toBe('/login');
    expect(staff.textContent).toContain('Staff sign in');
  });

  it('shows the current year in the footer', () => {
    const footer = render().debugElement.query(By.css('footer'))
      .nativeElement as HTMLElement;
    expect(footer.textContent).toContain(String(new Date().getFullYear()));
  });

  it('has a place for the page content', () => {
    expect(
      render().debugElement.query(By.css('main router-outlet')),
    ).not.toBeNull();
  });
});
