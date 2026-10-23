import {
  Component,
  computed,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { splitRequirements } from '../../core/job-postings/job-postings.models';

/**
 * Edits a list of requirements, one per item. The form value is a
 * newline-separated string, which is what the API stores.
 *
 * Enter adds an item, pasting several lines adds each one, and
 * Backspace in the empty box pulls the last item back for editing.
 */
@Component({
  selector: 'app-requirements-input',
  templateUrl: './requirements-input.html',
  styleUrl: './requirements-input.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RequirementsInput),
      multi: true,
    },
  ],
})
export class RequirementsInput implements ControlValueAccessor {
  readonly inputId = input('requirements');
  readonly maxItems = input(25);
  readonly maxLength = input(200);
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);

  protected readonly items = signal<string[]>([]);
  protected readonly draft = signal('');
  protected readonly notice = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly full = computed(() => this.items().length >= this.maxItems());

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.items.set(splitRequirements(value));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.add(this.draft());
    } else if (event.key === 'Backspace' && this.draft() === '' && this.items().length) {
      event.preventDefault();
      const last = this.items().at(-1)!;
      this.commit(this.items().slice(0, -1));
      this.setDraft(last);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!text.includes('\n')) return;
    event.preventDefault();
    this.add(text);
  }

  /** Adds one or more lines. Strips list markers people paste from documents. */
  add(text: string): void {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
      .filter(Boolean);
    if (!lines.length) return;

    const next = [...this.items()];
    const skipped: string[] = [];
    for (const line of lines) {
      const exists = next.some((item) => item.toLowerCase() === line.toLowerCase());
      if (exists || next.length >= this.maxItems() || line.length > this.maxLength()) {
        skipped.push(line);
      } else {
        next.push(line);
      }
    }

    this.commit(next);
    this.setDraft(skipped.length === 1 && lines.length === 1 ? skipped[0] : '');
    this.notice.set(this.explain(skipped, lines.length));
  }

  remove(index: number): void {
    this.commit(this.items().filter((_, i) => i !== index));
    this.notice.set(null);
    this.box().nativeElement.focus();
  }

  protected touch(): void {
    if (this.draft().trim()) this.add(this.draft());
    this.onTouched();
  }

  /** Writes to the element too, in case the template binding hasn't seen the typed text yet. */
  private setDraft(text: string): void {
    this.draft.set(text);
    this.box().nativeElement.value = text;
  }

  private commit(items: string[]): void {
    this.items.set(items);
    this.onChange(items.join('\n'));
  }

  private explain(skipped: string[], total: number): string | null {
    if (!skipped.length) return null;
    const first = skipped[0];
    if (first.length > this.maxLength()) {
      return `Keep each requirement under ${this.maxLength()} characters.`;
    }
    if (this.full() && !this.items().some((i) => i.toLowerCase() === first.toLowerCase())) {
      return `You can add up to ${this.maxItems()} requirements.`;
    }
    return total === 1
      ? 'That requirement is already on the list.'
      : `Skipped ${skipped.length} duplicate or extra lines.`;
  }
}
