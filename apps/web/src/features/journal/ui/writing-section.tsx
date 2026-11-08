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
 *
 * No rule sets the bar apart. The section's name is what marks where a part of
 * the day begins, with room above it, and pinned, the bar's own ground covers
 * the writing that scrolls under it.
 */

import { type ReactNode, useId } from 'react';

import { sectionHeadingClass } from '#/shared/ui/design-classes.ts';
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
        className={`group/writing pt-6 ${ground[tone]} ${className}`}
      >
        <div
          className={`sticky top-0 z-30 ${ground[tone]}`}
          data-formatting-toolbar=""
        >
          <PageFrame className="grid min-h-14 grid-cols-1 items-center sm:grid-cols-[1fr_auto] sm:gap-6">
            <h2
              className={`col-start-1 row-start-1 ${sectionHeadingClass} group-focus-within/writing:opacity-0 sm:group-focus-within/writing:opacity-100 ${fade}`}
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
        <PageFrame className="pt-4 pb-8">{children}</PageFrame>
      </section>
    </FormattingToolbarProvider>
  );
};
