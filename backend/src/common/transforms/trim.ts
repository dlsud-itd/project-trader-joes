/** For `@Transform(trim)`: removes spaces around text, leaves other values. */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
