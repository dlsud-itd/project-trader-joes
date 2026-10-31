import { Injectable } from '@nestjs/common';

/**
 * Runs screenings one at a time, in the order they were asked for
 * (WBS 4.3.2). The free Gemini tier refuses bursts of calls, and when the
 * same application is sent twice (a double click), the second run finds
 * the saved result instead of calling Gemini again.
 *
 * The queue lives in memory: the API runs as a single instance.
 */
@Injectable()
export class ScreeningQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private waiting = 0;

  /** Screenings added but not finished yet, including the running one. */
  get size(): number {
    return this.waiting;
  }

  /** Runs the task after every task added before it has finished. */
  run<T>(task: () => Promise<T>): Promise<T> {
    this.waiting++;
    const result = this.tail.then(task).finally(() => this.waiting--);
    // One failed task must not stop the ones queued after it.
    this.tail = result.catch(() => undefined);
    return result;
  }
}
