import { Component, input, output } from '@angular/core';
import { ApplicationsView } from '../applications-view';

/** The List / Board switch at the top of the Applications page. */
@Component({
  selector: 'app-view-toggle',
  templateUrl: './view-toggle.html',
  styleUrl: './view-toggle.scss',
})
export class ViewToggle {
  readonly view = input.required<ApplicationsView>();
  readonly viewChange = output<ApplicationsView>();

  protected readonly ApplicationsView = ApplicationsView;
}
