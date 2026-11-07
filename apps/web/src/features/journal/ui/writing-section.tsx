/**
 * A part of the day that is written in: the morning's notes or the evening's
 * entry, under a bar that carries the section's name and its writing tools.
 *
 * The bar pins to the top of the window while its section is on screen and
 * scrolls away with it, so the tools are only ever over the writing they act
 * on. They stay out of sight until the writer is in the section, and then
 * fade in where they were all along: their place is kept either way, so the
 * page never moves to make room. On a phone the name gives way to the tools,
 * because the two do not fit side by side there.
 */

import { type ReactNode, useId } from 'react';

import { PageFrame } from '#/shared/ui/page-frame.tsx';
import {
  FormattingToolbar,
  FormattingToolbarProvider,
} from './formatting-toolbar.tsx';
import type { WritingTone } from './journal-icon-button.tsx';

const ground: Record<WritingTone, string> = {
  deep: 'bg-deep-ground text-deep-ink',
  page: 'bg-background text-ink',
};

const rule: Record<WritingTone, string> = {
  deep: 'border-deep-rule/50',
  page: 'border-border',
};

const fade =
  'transition-opacity duration-200 ease-standard motion-reduce:transition-none';

export const WritingSection = ({
  title,
  tone,
  className = '',
  children,
}: {
  readonly title: string;
  readonly tone: WritingTone;
  readonly className?: string;
  readonly children: ReactNode;
}) => {
  const headingId = useId();
  return (
    <FormattingToolbarProvider>
      <section
        aria-labelledby={headingId}
        className={`group/writing ${ground[tone]} ${className}`}
      >
        <div
          className={`sticky top-0 z-30 border-b ${ground[tone]} ${rule[tone]}`}
          data-formatting-toolbar=""
        >
          <PageFrame className="grid min-h-14 grid-cols-1 items-center sm:grid-cols-[1fr_auto] sm:gap-6">
            <h2
              className={`col-start-1 row-start-1 font-display text-xl group-focus-within/writing:opacity-0 sm:group-focus-within/writing:opacity-100 ${fade}`}
              id={headingId}
            >
              {title}
            </h2>
            <div
              className={`pointer-events-none col-start-1 row-start-1 opacity-0 group-focus-within/writing:pointer-events-auto group-focus-within/writing:opacity-100 sm:col-start-2 ${fade}`}
            >
              <FormattingToolbar tone={tone} />
            </div>
          </PageFrame>
        </div>
        <PageFrame className="pt-6 pb-8">{children}</PageFrame>
      </section>
    </FormattingToolbarProvider>
  );
};
