/**
 * The words of a day report document: its rich text, which is plain,
 * emphasised, inline code, or an http(s) link and nothing else, and its
 * headings, a level below the "Day report" heading the evening gives it.
 */

import type { ReactNode } from 'react';

import { focusRingClass } from '#/shared/ui/design-classes.ts';
import type { Span } from '../schemas/day-report-text.ts';

const spanView = (span: Span, key: number): ReactNode => {
  if (typeof span === 'string') {
    return span;
  }
  if ('emphasis' in span) {
    return <em key={key}>{span.emphasis}</em>;
  }
  if ('code' in span) {
    return (
      <code className="bg-surface-sunken px-1 font-mono text-[0.9em]" key={key}>
        {span.code}
      </code>
    );
  }
  return (
    <a
      className={`text-primary underline decoration-1 underline-offset-2 hover:text-primary-strong ${focusRingClass}`}
      href={span.href}
      key={key}
      rel="noreferrer"
    >
      {span.link}
    </a>
  );
};

export const RichText = ({ text }: { readonly text: ReadonlyArray<Span> }) => (
  <>{text.map(spanView)}</>
);

/** How deep a block sits: 0 at the document's top, 1 in a section, and so on. */
export type Depth = number;

const headingTags = ['h4', 'h5', 'h6'] as const;

const headingClasses = [
  'font-display text-xl text-ink',
  'font-semibold text-base text-ink',
  'font-semibold text-ink-muted text-sm',
] as const;

const headingClassOf = (depth: Depth): string =>
  headingClasses[Math.min(depth, headingClasses.length - 1)] ?? '';

export const ReportHeading = ({
  depth,
  id,
  className = '',
  children,
}: {
  readonly depth: Depth;
  readonly id?: string;
  readonly className?: string;
  readonly children: ReactNode;
}) => {
  const Tag = headingTags[Math.min(depth, headingTags.length - 1)] ?? 'h6';
  return (
    <Tag className={`${headingClassOf(depth)} ${className}`} id={id}>
      {children}
    </Tag>
  );
};
