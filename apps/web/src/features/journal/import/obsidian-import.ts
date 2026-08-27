import { isJournalDate } from '../journal-day.ts';
import type {
  JournalImportIssue,
  JournalImportRecord,
  JournalImportResult,
} from './import-record.ts';
import { normalizedMarkdown } from './import-record.ts';

export type JournalImportSource = {
  readonly path: string;
  readonly content: string;
};

const dailyFilename = /^(?<date>\d{4}-\d{2}-\d{2})\.md$/u;
const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const months = monthNames.join('|');
const humanDateSource = `(?:${weekdays.join('|')}), (?<month>${months}) (?<day>\\d{1,2}),? (?<year>\\d{4})`;
const combinedHumanDate = new RegExp(
  `^(?<label>${humanDateSource})[ \\t]*$`,
  'gmu',
);
const monthNumber = new Map<string, number>(
  monthNames.map((month, index) => [month, index + 1] as const),
);
const humanDateParts = new RegExp(
  `^(?:${weekdays.join('|')}), (${months}) (\\d{1,2}),? (\\d{4})$`,
  'u',
);
const yearWidth = 4;
const monthDayWidth = 2;
const pathSeparator = /[\\/]/u;
const filenameOf = (path: string): string =>
  path.split(pathSeparator).at(-1) ?? path;

const dateOfHumanLabel = (label: string): string | undefined => {
  if (!humanDateParts.test(label)) {
    return undefined;
  }
  const [, monthName, dayValue, yearValue] = label
    .replaceAll(',', '')
    .split(' ');
  const month = monthNumber.get(monthName ?? '');
  const day = Number(dayValue);
  const year = Number(yearValue);
  if (
    month === undefined ||
    !Number.isInteger(day) ||
    !Number.isInteger(year)
  ) {
    return undefined;
  }
  const date = `${String(year).padStart(yearWidth, '0')}-${String(month).padStart(monthDayWidth, '0')}-${String(day).padStart(monthDayWidth, '0')}`;
  return isJournalDate(date) ? date : undefined;
};

const dailyRecord = (
  source: JournalImportSource,
  date: string,
): JournalImportRecord | undefined => {
  const markdown = normalizedMarkdown(source.content);
  if (markdown === '') {
    return undefined;
  }
  const firstLineEnd = markdown.indexOf('\n');
  const firstLine = markdown
    .slice(0, firstLineEnd === -1 ? undefined : firstLineEnd)
    .trimEnd();
  const body =
    dateOfHumanLabel(firstLine) === date
      ? markdown.slice(firstLineEnd === -1 ? markdown.length : firstLineEnd + 1)
      : markdown;
  return {
    date,
    journalMarkdown: normalizedMarkdown(body),
    scriptureMarkdown: '',
    source: source.path,
  };
};

const oldJournalRecord = (
  source: JournalImportSource,
  wantedDate: string,
): JournalImportRecord | undefined => {
  const matches = [...source.content.matchAll(combinedHumanDate)];
  const at = matches.findIndex(
    (candidate) =>
      dateOfHumanLabel(candidate.groups?.label ?? '') === wantedDate,
  );
  const match = matches[at];
  if (match === undefined || match.index === undefined) {
    return undefined;
  }
  const start = match.index + match[0].length;
  const end = matches[at + 1]?.index ?? source.content.length;
  return {
    date: wantedDate,
    journalMarkdown: normalizedMarkdown(source.content.slice(start, end)),
    scriptureMarkdown: '',
    source: source.path,
  };
};

export const parseObsidianJournal = (
  sources: ReadonlyArray<JournalImportSource>,
): JournalImportResult => {
  const records: Array<JournalImportRecord> = [];
  const issues: Array<JournalImportIssue> = [];
  for (const source of sources) {
    const match = dailyFilename.exec(filenameOf(source.path));
    const date = match?.groups?.date;
    if (date !== undefined && !isJournalDate(date)) {
      issues.push({
        source: source.path,
        message: 'Filename date is invalid.',
      });
    }
    if (date !== undefined && isJournalDate(date)) {
      const record = dailyRecord(source, date);
      if (record !== undefined) {
        records.push(record);
      }
    }
  }

  const oldJournal = sources.find(
    (source) => filenameOf(source.path) === 'Altes Tagebuch.md',
  );
  const recovered =
    oldJournal === undefined
      ? undefined
      : oldJournalRecord(oldJournal, '2024-11-16');
  if (recovered === undefined) {
    issues.push({
      source: oldJournal?.path ?? 'Altes Tagebuch.md',
      message: 'The missing 2024-11-16 entry was not found.',
    });
  } else {
    records.push(recovered);
  }
  return { records, issues };
};
