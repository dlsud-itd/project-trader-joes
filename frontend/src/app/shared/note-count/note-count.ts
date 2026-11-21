import { Component, computed, input } from '@angular/core';

/** "3 notes" with a speech-bubble icon. Hidden when there are none. */
@Component({
  selector: 'app-note-count',
  template: `
    @if (count() > 0) {
      <span
        class="notes"
        [attr.title]="label()"
        [attr.aria-label]="label()"
        role="img"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path
            d="M3 2.75h10A1.25 1.25 0 0 1 14.25 4v6A1.25 1.25 0 0 1 13 11.25H7.2L4.4 13.6a.4.4 0 0 1-.65-.3v-2.05H3A1.25 1.25 0 0 1 1.75 10V4A1.25 1.25 0 0 1 3 2.75Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
        {{ count() }}
      </span>
    }
  `,
  styles: `
    .notes {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--tf-muted);
      font-size: 12.5px;
      font-weight: 600;
      white-space: nowrap;
    }
  `,
})
export class NoteCount {
  readonly count = input.required<number>();

  protected readonly label = computed(() =>
    this.count() === 1 ? '1 note' : `${this.count()} notes`,
  );
}
