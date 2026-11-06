import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ApplicationRow, KanbanStage } from '../../../core/applications';
import { TEST_APPLICATIONS } from '../test-applications';
import { ApplicationsBoard, StageMove } from './applications-board';

type StageDrop = CdkDragDrop<KanbanStage, KanbanStage, ApplicationRow>;

const byName = (name: string): ApplicationRow =>
  TEST_APPLICATIONS.find(
    (r: ApplicationRow) => r.full_name === name,
  ) as ApplicationRow;

const textOf = (node: Element | null): string | undefined =>
  node?.textContent?.trim();

describe('ApplicationsBoard', () => {
  let fixture: ComponentFixture<ApplicationsBoard>;
  let moves: StageMove[] = [];

  const el = () => fixture.nativeElement as HTMLElement;
  const columns = (): Element[] => Array.from(el().querySelectorAll('.column'));
  const column = (stage: KanbanStage): HTMLElement =>
    columns().find(
      (c: Element) =>
        textOf(c.querySelector('.column__head .tf-stage')) === stage,
    ) as HTMLElement;
  const namesIn = (stage: KanbanStage): (string | undefined)[] =>
    Array.from(column(stage).querySelectorAll('.card__name')).map(textOf);
  const moveSelect = (name: string): HTMLSelectElement =>
    el().querySelector<HTMLSelectElement>(
      `.card__move[aria-label="Stage for ${name}"]`,
    ) as HTMLSelectElement;
  const dropLists = (): CdkDropList<KanbanStage>[] =>
    fixture.debugElement
      .queryAll(By.directive(CdkDropList))
      .map((d: DebugElement) => d.injector.get(CdkDropList<KanbanStage>));

  /** Fires the drop list's event, as the CDK does when a card is let go. */
  const drop = (
    row: ApplicationRow,
    from: KanbanStage,
    to: KanbanStage,
  ): void => {
    const lists = dropLists();
    const listFor = (stage: KanbanStage) =>
      lists.find((l: CdkDropList<KanbanStage>) => l.data === stage);
    const target = listFor(to) as CdkDropList<KanbanStage>;
    target.dropped.emit({
      item: { data: row },
      container: target,
      previousContainer: listFor(from),
    } as unknown as StageDrop);
  };

  function render(
    canMove: boolean,
    rows: ApplicationRow[] = TEST_APPLICATIONS,
  ): void {
    TestBed.configureTestingModule({
      imports: [ApplicationsBoard],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ApplicationsBoard);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('canMove', canMove);
    moves = [];
    fixture.componentInstance.move.subscribe((m: StageMove) => moves.push(m));
    fixture.detectChanges();
  }

  it('shows one column per stage, in pipeline order, with counts', () => {
    render(true);
    const heads = columns().map((c: Element) => [
      textOf(c.querySelector('.column__head .tf-stage')),
      textOf(c.querySelector('.column__count')),
    ]);
    expect(heads).toEqual([
      ['Applied', '3'],
      ['Screening', '3'],
      ['Interview', '1'],
      ['Offer', '0'],
      ['Rejected', '1'],
    ]);
  });

  it('puts each applicant in the column of their stage', () => {
    render(true);
    expect(namesIn(KanbanStage.INTERVIEW)).toEqual(['Aisha Rahman']);
    expect(namesIn(KanbanStage.REJECTED)).toEqual(['Daniel Okafor']);
    expect(column(KanbanStage.OFFER).textContent).toContain('No applicants');
  });

  it('keeps the order it is given inside each column', () => {
    const reversed = [...TEST_APPLICATIONS].reverse();
    render(true, reversed);
    const applied = reversed
      .filter((r: ApplicationRow) => r.kanban_stage === KanbanStage.APPLIED)
      .map((r: ApplicationRow) => r.full_name);
    expect(namesIn(KanbanStage.APPLIED)).toEqual(applied);
  });

  it('links each card to the applicant profile', () => {
    render(true);
    const aisha = byName('Aisha Rahman');
    const link = Array.from(
      el().querySelectorAll<HTMLAnchorElement>('.card__name'),
    ).find((a: HTMLAnchorElement) => a.textContent?.includes('Aisha Rahman'));
    expect(link?.getAttribute('href')).toBe(`/applications/${aisha.id}`);
  });

  it('asks to move a card dropped in another column', () => {
    render(true);
    const aisha = byName('Aisha Rahman');
    drop(aisha, KanbanStage.INTERVIEW, KanbanStage.OFFER);
    expect(moves).toEqual([{ row: aisha, stage: KanbanStage.OFFER }]);
  });

  it('ignores a card dropped back in its own column', () => {
    render(true);
    const aisha = byName('Aisha Rahman');
    drop(aisha, KanbanStage.INTERVIEW, KanbanStage.INTERVIEW);
    expect(moves).toEqual([]);
  });

  it('moves a card from its stage menu (keyboard alternative)', () => {
    render(true);
    const select = moveSelect('Daniel Okafor');
    expect(select.value).toBe(KanbanStage.REJECTED);

    select.value = KanbanStage.SCREENING;
    select.dispatchEvent(new Event('change'));
    expect(moves).toEqual([
      { row: byName('Daniel Okafor'), stage: KanbanStage.SCREENING },
    ]);
  });

  it('is read-only when the user cannot move applicants', () => {
    render(false);
    expect(el().querySelectorAll('.card__move').length).toBe(0);
    expect(dropLists().every((l: CdkDropList<KanbanStage>) => l.disabled)).toBe(
      true,
    );
    expect(el().querySelector('.card.cdk-drag-disabled')).not.toBeNull();
  });

  it('locks a card while its move is saving', () => {
    render(true);
    const aisha = byName('Aisha Rahman');
    fixture.componentRef.setInput('moving', new Set([aisha.id]));
    fixture.detectChanges();

    expect(moveSelect('Aisha Rahman').disabled).toBe(true);
    expect(
      column(KanbanStage.INTERVIEW).querySelector('.card.is-moving'),
    ).not.toBeNull();
  });
});
