/**
 * Tailwind only builds the classes it finds written out, so each column count
 * a week or a month can have is spelled here, indexed by the count less one.
 */
const columnClasses = [
  'grid-cols-1',
  'grid-cols-2',
  'grid-cols-3',
  'grid-cols-4',
  'grid-cols-5',
  'grid-cols-6',
  'grid-cols-7',
  'grid-cols-8',
  'grid-cols-9',
  'grid-cols-10',
  'grid-cols-11',
  'grid-cols-12',
  'grid-cols-13',
  'grid-cols-14',
  'grid-cols-15',
  'grid-cols-16',
  'grid-cols-17',
  'grid-cols-18',
  'grid-cols-19',
  'grid-cols-20',
  'grid-cols-21',
  'grid-cols-22',
  'grid-cols-23',
  'grid-cols-24',
  'grid-cols-25',
  'grid-cols-26',
  'grid-cols-27',
  'grid-cols-28',
  'grid-cols-29',
  'grid-cols-30',
  'grid-cols-31',
] as const;

export const dayColumnsClass = (count: number): string =>
  columnClasses[count - 1] ?? 'grid-cols-7';
