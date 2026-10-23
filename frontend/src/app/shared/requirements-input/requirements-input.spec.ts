import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { RequirementsInput } from './requirements-input';

@Component({
  imports: [ReactiveFormsModule, RequirementsInput],
  template: `<app-requirements-input
    [formControl]="control"
    [maxItems]="3"
    [maxLength]="20"
  />`,
})
class Host {
  control = new FormControl('JavaScript\nSQL', { nonNullable: true });
}

describe('RequirementsInput', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const box = () =>
    fixture.debugElement.query(By.css('input'))
      .nativeElement as HTMLInputElement;
  const items = () =>
    fixture.debugElement
      .queryAll(By.css('.req__text'))
      .map((el) => el.nativeElement.textContent.trim());
  const notice = () =>
    fixture.debugElement
      .query(By.css('.req__notice'))
      ?.nativeElement.textContent.trim();

  const type = (text: string) => {
    box().value = text;
    box().dispatchEvent(new Event('input'));
    box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the form value as a list', () => {
    expect(items()).toEqual(['JavaScript', 'SQL']);
  });

  it('adds an item on Enter and updates the form value', () => {
    type('Git');
    expect(items()).toEqual(['JavaScript', 'SQL', 'Git']);
    expect(host.control.value).toBe('JavaScript\nSQL\nGit');
    expect(box().value).toBe('');
  });

  it('ignores duplicates regardless of case', () => {
    type('sql');
    expect(items()).toEqual(['JavaScript', 'SQL']);
    expect(notice()).toBe('That requirement is already on the list.');
  });

  it('rejects items over the length limit', () => {
    type('A requirement that is far too long');
    expect(items()).toHaveLength(2);
    expect(notice()).toContain('under 20 characters');
  });

  it('removes an item', () => {
    fixture.debugElement
      .queryAll(By.css('.req__remove'))[0]
      .nativeElement.click();
    fixture.detectChanges();
    expect(host.control.value).toBe('SQL');
  });

  it('pulls the last item back with Backspace in the empty box', () => {
    box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    fixture.detectChanges();
    expect(items()).toEqual(['JavaScript']);
    expect(box().value).toBe('SQL');
  });

  it('splits a pasted list into items and strips bullets', () => {
    host.control.setValue('');
    fixture.detectChanges();
    const paste = new Event('paste') as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', {
      value: {
        getData: () => '- Angular\n• NestJS\n1. PostgreSQL\n2. Docker',
      },
    });
    box().dispatchEvent(paste);
    fixture.detectChanges();
    expect(items()).toEqual(['Angular', 'NestJS', 'PostgreSQL']);
    expect(box().disabled).toBe(true);
  });
});
