import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  formatFileSize,
  RESUME_MAX_BYTES,
  ResumeInput,
  resumeFileError,
} from './resume-input';

const fileOf = (name: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type: 'application/octet-stream' });

describe('resumeFileError', () => {
  it('accepts PDF files up to 5 MB', () => {
    expect(resumeFileError(fileOf('cv.pdf'))).toBeNull();
    expect(resumeFileError(fileOf('CV.PDF'))).toBeNull();
    expect(resumeFileError(fileOf('cv.pdf', RESUME_MAX_BYTES))).toBeNull();
  });

  it('refuses other types, empty files, and files over 5 MB', () => {
    expect(resumeFileError(fileOf('cv.docx'))).toBe('Choose a PDF file.');
    expect(resumeFileError(fileOf('cv.doc'))).toBe('Choose a PDF file.');
    expect(resumeFileError(fileOf('photo.png'))).toBe('Choose a PDF file.');
    expect(resumeFileError(fileOf('cv.pdf', 0))).toMatch(/empty/);
    expect(resumeFileError(fileOf('cv.pdf', RESUME_MAX_BYTES + 1))).toMatch(
      /5 MB/,
    );
  });
});

describe('formatFileSize', () => {
  it('uses B, KB, or MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(250 * 1024)).toBe('250 KB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('ResumeInput', () => {
  let fixture: ComponentFixture<ResumeInput>;

  const text = () => fixture.nativeElement.textContent as string;
  const pick = (file: File) => {
    const input = fixture.debugElement.query(
      By.css('input[type=file]'),
    ).nativeElement;
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(ResumeInput);
    fixture.detectChanges();
  });

  it('keeps a valid file and shows its name and size', () => {
    pick(fileOf('Juan CV.pdf', 2048));
    expect(fixture.componentInstance.file()?.name).toBe('Juan CV.pdf');
    expect(text()).toContain('Juan CV.pdf');
    expect(text()).toContain('2 KB');
  });

  it('refuses a wrong file and explains why', () => {
    pick(fileOf('photo.png'));
    expect(fixture.componentInstance.file()).toBeNull();
    expect(text()).toContain('Choose a PDF file.');
  });

  it('refuses a Word file', () => {
    pick(fileOf('Juan CV.docx'));
    expect(fixture.componentInstance.file()).toBeNull();
    expect(text()).toContain('Choose a PDF file.');
  });

  it('accepts a dropped file', () => {
    const drop = new Event('drop') as DragEvent;
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [fileOf('cv.pdf')] },
    });
    fixture.debugElement
      .query(By.css('.drop'))
      .nativeElement.dispatchEvent(drop);
    fixture.detectChanges();
    expect(fixture.componentInstance.file()?.name).toBe('cv.pdf');
  });

  it('can remove the chosen file', () => {
    pick(fileOf('cv.pdf'));
    fixture.debugElement.query(By.css('.chosen button')).nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.file()).toBeNull();
    expect(fixture.debugElement.query(By.css('.chosen'))).toBeNull();
  });

  it('asks for a resume when the form was submitted without one', () => {
    fixture.componentRef.setInput('isMissing', true);
    fixture.detectChanges();
    expect(text()).toContain('Attach your resume.');
  });
});
