/** Derive ticket title from description when the title step is skipped. */
export function titleFromDescription(description: string, max = 80): string {
  const one = description.trim().replace(/\s+/g, ' ');
  if (!one) return 'Без названия';
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}
