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
import { PostingLimit, splitRequirements } from '../../core/job-postings';

/** List markers pasted from documents: "- ", "* ", "• ", "1. ", "2) ". */
const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

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
  readonly maxItems = input<number>(PostingLimit.REQUIREMENTS_MAX);
  readonly maxLength = input<number>(PostingLimit.REQUIREMENT_LENGTH_MAX);
  readonly isInvalid = input(false);
  readonly describedBy = input<string | null>(null);

  protected readonly items = signal<string[]>([]);
  protected readonly draft = signal('');
  protected readonly notice = signal<string | null>(null);
  protected readonly isDisabled = signal(false);
  protected readonly isFull = computed(
    () => this.items().length >= this.maxItems(),
  );

  private readonly box =
    viewChild.required<ElementRef<HTMLInputElement>>('box');
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
    this.isDisabled.set(isDisabled);
  }

  /** Lets a parent form move the cursor here, e.g. to the first error. */
  focus(): void {
    this.box().nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const isEmpty = this.draft() === '';
    if (event.key === 'Enter') {
      event.preventDefault();
      this.add(this.draft());
    } else if (event.key === 'Backspace' && isEmpty && this.items().length) {
      event.preventDefault();
      const last = this.items().at(-1) ?? '';
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

  /** Adds one or more lines. Strips list markers pasted from documents. */
  add(text: string): void {
    const lines = text
      .split(/\r?\n/)
      .map((line: string) => line.replace(LIST_MARKER, '').trim())
      .filter(Boolean);
    if (!lines.length) return;

    const next = [...this.items()];
    const skipped: string[] = [];
    for (const line of lines) {
      const isDuplicate = next.some(
        (item: string) => item.toLowerCase() === line.toLowerCase(),
      );
      const isTooLong = line.length > this.maxLength();
      if (isDuplicate || next.length >= this.maxItems() || isTooLong) {
        skipped.push(line);
      } else {
        next.push(line);
      }
    }

    this.commit(next);
    const isSingleSkip = skipped.length === 1 && lines.length === 1;
    this.setDraft(isSingleSkip ? skipped[0] : '');
    this.notice.set(this.explain(skipped, lines.length));
  }

  remove(index: number): void {
    this.commit(this.items().filter((_: string, i: number) => i !== index));
    this.notice.set(null);
    this.focus();
  }

  protected touch(): void {
    if (this.draft().trim()) this.add(this.draft());
    this.onTouched();
  }

  /**
   * Writes to the element too, in case the template binding hasn't seen
   * the typed text yet.
   */
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
    const isListed = this.items().some(
      (item: string) => item.toLowerCase() === first.toLowerCase(),
    );
    if (this.isFull() && !isListed) {
      return `You can add up to ${this.maxItems()} requirements.`;
    }
    return total === 1
      ? 'That requirement is already on the list.'
      : `Skipped ${skipped.length} duplicate or extra lines.`;
  }
}
