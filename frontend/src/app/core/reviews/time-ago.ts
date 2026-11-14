const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Older than this shows the date instead, e.g. "Oct 21, 2026". */
const MAX_RELATIVE_DAYS = 7;

const plural = (n: number, unit: string): string =>
  `${n} ${unit}${n === 1 ? '' : 's'} ago`;

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", "Oct 21, 2026". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const elapsed = Math.max(0, now.getTime() - then.getTime());
  if (elapsed < MINUTE_MS) return 'just now';
  if (elapsed < HOUR_MS)
    return plural(Math.floor(elapsed / MINUTE_MS), 'minute');
  if (elapsed < DAY_MS) return plural(Math.floor(elapsed / HOUR_MS), 'hour');
  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return 'yesterday';
  if (days < MAX_RELATIVE_DAYS) return `${days} days ago`;
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
