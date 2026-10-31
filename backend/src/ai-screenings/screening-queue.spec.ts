import { ScreeningQueue } from './screening-queue.js';

/** A task that finishes only when `finish` is called. */
function heldTask<T>(value: T) {
  let finish = () => {};
  const done = new Promise<T>((resolve) => {
    finish = () => resolve(value);
  });
  return { task: () => done, finish };
}

describe('ScreeningQueue', () => {
  it('runs one task at a time, in order', async () => {
    const queue = new ScreeningQueue();
    const first = heldTask('first');
    const second = vi.fn(async () => 'second');

    const firstResult = queue.run(first.task);
    const secondResult = queue.run(second);
    await Promise.resolve();

    expect(second).not.toHaveBeenCalled();
    expect(queue.size).toBe(2);

    first.finish();
    await expect(firstResult).resolves.toBe('first');
    await expect(secondResult).resolves.toBe('second');
    expect(queue.size).toBe(0);
  });

  it('keeps going after a task fails', async () => {
    const queue = new ScreeningQueue();
    const failed = queue.run(async () => {
      throw new Error('Gemini is down');
    });
    const next = queue.run(async () => 'next');

    await expect(failed).rejects.toThrow('Gemini is down');
    await expect(next).resolves.toBe('next');
    expect(queue.size).toBe(0);
  });
});
