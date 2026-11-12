/**
 * The words and values a day report document is made of, shared by its
 * blocks (`day-report-blocks.ts`) and its timeline (`day-report-timeline.ts`).
 *
 * Text is restricted on purpose. A document holds no markup, styles, or
 * scripts: a heading or a label is plain text, and prose is rich text, a list
 * of spans that are each plain, emphasised, inline code, or an http(s) link.
 * Spans don't nest, so nothing can be emphasised and linked at once.
 *
 * Numbers are values, not text: minutes, counts, and instants with their
 * offset, so Postlude formats them, and a change to how it does reaches every
 * report already stored.
 */

import { Schema } from 'effect';

import { IsoInstantSchema } from './day-metrics.ts';

const labelLengthLimit = 200;
const headingLengthLimit = 200;
const spanLengthLimit = 10_000;
const spansPerText = 200;
const urlLengthLimit = 2048;
const summaryLengthLimit = 300;

const nonBlank = Schema.makeFilter((value: string) => value.trim() !== '', {
  identifier: 'NonBlank',
  expected: 'text that is not only white space',
});

/** A short plain-text name: a tile's label, a row's label, a list item's note. */
export const ReportLabelSchema = Schema.String.check(
  Schema.isMaxLength(labelLengthLimit),
  nonBlank,
);

/** A sentence or two of plain text, such as what a pull request changed. */
export const ReportSummarySchema = Schema.String.check(
  Schema.isMaxLength(summaryLengthLimit),
  nonBlank,
);

/** A plain-text heading of a section, a part, or the timeline. */
export const ReportHeadingSchema = Schema.String.check(
  Schema.isMaxLength(headingLengthLimit),
  nonBlank,
);

const SpanTextSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(spanLengthLimit),
);

const isHttpUrl = (value: string): boolean => {
  if (value.length > urlLengthLimit || !URL.canParse(value)) {
    return false;
  }
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
};

export const HttpUrlSchema = Schema.String.check(
  Schema.makeFilter(isHttpUrl, {
    identifier: 'HttpUrl',
    expected: `an http or https URL of at most ${urlLengthLimit} characters`,
  }),
);

type MarkedSpan =
  | { readonly emphasis: string }
  | { readonly code: string }
  | { readonly link: string; readonly href: string };

const MarkedSpanFieldsSchema = Schema.Struct({
  emphasis: Schema.optionalKey(SpanTextSchema),
  code: Schema.optionalKey(SpanTextSchema),
  link: Schema.optionalKey(SpanTextSchema),
  href: Schema.optionalKey(HttpUrlSchema),
});

const isMarkedSpan = (
  span: Schema.Schema.Type<typeof MarkedSpanFieldsSchema>,
): span is MarkedSpan => {
  const keys = Object.keys(span).length;
  return keys === 1
    ? 'emphasis' in span || 'code' in span
    : keys === 2 && 'link' in span && 'href' in span;
};

/**
 * Emphasis, code, or a link. It is one object with a rule, not a union of
 * three, so a span that is none of them is refused with one message that says
 * what a span may be, instead of one for each kind it isn't.
 */
const MarkedSpanSchema = MarkedSpanFieldsSchema.pipe(
  Schema.refine(isMarkedSpan, {
    identifier: 'MarkedSpan',
    expected:
      'a span that is text, {"emphasis": text}, {"code": text}, or {"link": text, "href": an http(s) URL}',
  }),
);

export const SpanSchema = Schema.Union([SpanTextSchema, MarkedSpanSchema]);

export type Span = Schema.Schema.Type<typeof SpanSchema>;

/** Prose: at least one span. */
export const RichTextSchema = Schema.Array(SpanSchema).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(spansPerText),
);

export type RichText = Schema.Schema.Type<typeof RichTextSchema>;

/** A table cell, which may be empty. */
export const CellTextSchema = Schema.Array(SpanSchema).check(
  Schema.isMaxLength(spansPerText),
);

export const MinutesSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const CountSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const InstantSchema = IsoInstantSchema;

/** A span of time, which ends no earlier than it starts. */
export const timeRangeFields = { start: InstantSchema, end: InstantSchema };

export const endsAfterStart = Schema.makeFilter(
  ({ start, end }: { readonly start: string; readonly end: string }) =>
    Date.parse(end) >= Date.parse(start),
  {
    identifier: 'EndsAfterStart',
    expected: 'an end no earlier than its start',
  },
);

/** The words of rich text without their emphasis, code, or links. */
export const spanText = (span: Span): string => {
  if (typeof span === 'string') {
    return span;
  }
  if ('emphasis' in span) {
    return span.emphasis;
  }
  return 'code' in span ? span.code : span.link;
};

export const richTextPlain = (text: ReadonlyArray<Span>): string =>
  text.map(spanText).join('');
