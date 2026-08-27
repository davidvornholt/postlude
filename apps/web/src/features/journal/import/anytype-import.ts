import { Either, Schema } from 'effect';
import { parseDocument } from 'yaml';

import { isJournalDate } from '../journal-day.ts';
import { parseScriptureReference } from '../scripture-reference.ts';
import type {
  JournalImportIssue,
  JournalImportResult,
} from './import-record.ts';
import { normalizedMarkdown } from './import-record.ts';
import type { JournalImportSource } from './obsidian-import.ts';

const frontmatter = /^---[ \t]*\n(?<yaml>[\s\S]*?)\n---[ \t]*(?:\n|$)/u;
const firstHeading = /^\s*# [^\n]*(?:\n|$)/u;
const quietTimeHeading = /^## Quiet time\s*$/mu;
const reflectionHeading = /^## Reflection\s*$/mu;

const MetadataSchema = Schema.Struct({
  date: Schema.propertySignature(Schema.String).pipe(Schema.fromKey('Date')),
  scripture: Schema.optional(Schema.NullOr(Schema.String)).pipe(
    Schema.fromKey('Scripture'),
  ),
});
type Metadata = Schema.Schema.Type<typeof MetadataSchema>;

const metadataOf = (
  source: JournalImportSource,
  yaml: string,
  issues: Array<JournalImportIssue>,
): Metadata | undefined => {
  const document = parseDocument(yaml);
  if (document.errors.length > 0) {
    issues.push({
      source: source.path,
      message: 'Frontmatter YAML is invalid.',
    });
    return undefined;
  }
  const decoded = Schema.decodeUnknownEither(MetadataSchema)(document.toJS());
  if (Either.isLeft(decoded)) {
    issues.push({
      source: source.path,
      message: 'Frontmatter Date or Scripture metadata has the wrong shape.',
    });
    return undefined;
  }
  return decoded.right;
};

const parseAnytypeEntry = (
  source: JournalImportSource,
): JournalImportResult => {
  const issues: Array<JournalImportIssue> = [];
  const match = frontmatter.exec(source.content.replaceAll('\r\n', '\n'));
  if (match?.groups?.yaml === undefined) {
    return {
      records: [],
      issues: [{ source: source.path, message: 'Frontmatter is missing.' }],
    };
  }
  const metadata = metadataOf(source, match.groups.yaml, issues);
  if (metadata === undefined) {
    return { records: [], issues };
  }
  const { date, scripture: enteredReference } = metadata;
  if (!isJournalDate(date)) {
    issues.push({ source: source.path, message: 'Date metadata is invalid.' });
  }
  const reference =
    typeof enteredReference === 'string' && enteredReference.trim() !== ''
      ? parseScriptureReference(enteredReference)
      : undefined;
  if (
    enteredReference !== undefined &&
    enteredReference !== null &&
    enteredReference.trim() !== '' &&
    reference === undefined
  ) {
    issues.push({
      source: source.path,
      message: 'Scripture metadata is invalid.',
    });
  }

  const body = source.content
    .replaceAll('\r\n', '\n')
    .slice(match[0].length)
    .replace(firstHeading, '');
  const quiet = quietTimeHeading.exec(body);
  if (quiet?.index === undefined) {
    issues.push({
      source: source.path,
      message: 'Quiet time section is missing.',
    });
  }
  if (issues.length > 0 || quiet === null) {
    return { records: [], issues };
  }
  const beforeQuiet = normalizedMarkdown(body.slice(0, quiet.index));
  if (beforeQuiet !== '') {
    issues.push({
      source: source.path,
      message: 'Unexpected content appears before Quiet time.',
    });
    return { records: [], issues };
  }
  const afterQuiet = body.slice(quiet.index + quiet[0].length);
  const reflection = reflectionHeading.exec(afterQuiet);
  const scriptureMarkdown = normalizedMarkdown(
    reflection === null ? afterQuiet : afterQuiet.slice(0, reflection.index),
  );
  const journalMarkdown = normalizedMarkdown(
    reflection === null
      ? ''
      : afterQuiet.slice(reflection.index + reflection[0].length),
  );
  return {
    records: [
      {
        date,
        journalMarkdown,
        scriptureMarkdown,
        ...(reference === undefined ? {} : { scriptureReference: reference }),
        source: source.path,
      },
    ],
    issues,
  };
};

export const parseAnytypeJournal = (
  sources: ReadonlyArray<JournalImportSource>,
): JournalImportResult => {
  const parsed = sources.map(parseAnytypeEntry);
  return {
    records: parsed.flatMap((result) => result.records),
    issues: parsed.flatMap((result) => result.issues),
  };
};
