import { ServiceUnavailableException } from '@nestjs/common';
import { MAX_SCREENING_QUEUE_SIZE } from './ai-screenings.constants.js';
import { AiScreeningsService } from './ai-screenings.service.js';
import type { ScreeningQueue } from './screening-queue.js';

/** A stand-in for ScreeningQueue with a fixed `size` and a spy on `run`. */
function fakeQueue(size: number) {
  return { size, run: vi.fn(() => Promise.resolve(undefined)) };
}

describe('AiScreeningsService.screen (queue cap)', () => {
  it('refuses new work once the queue is full, without touching the queue', () => {
    const queue = fakeQueue(MAX_SCREENING_QUEUE_SIZE);
    const service = new AiScreeningsService(
      {} as never,
      {} as never,
      {} as never,
      queue as unknown as ScreeningQueue,
    );

    expect(() => service.screen(1, false)).toThrow(
      ServiceUnavailableException,
    );
    expect(queue.run).not.toHaveBeenCalled();
  });

  it('still accepts work one below the cap', () => {
    const queue = fakeQueue(MAX_SCREENING_QUEUE_SIZE - 1);
    const service = new AiScreeningsService(
      {} as never,
      {} as never,
      {} as never,
      queue as unknown as ScreeningQueue,
    );

    expect(() => service.screen(1, false)).not.toThrow();
    expect(queue.run).toHaveBeenCalledTimes(1);
  });
});
