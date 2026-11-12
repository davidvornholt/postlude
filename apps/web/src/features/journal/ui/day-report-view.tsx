/**
 * A day report document, drawn: its blocks in the order /wrap composed them,
 * each by the component for its kind, and a section's blocks a heading level
 * below the section's own. Adding a kind of block takes its schema and one
 * component here.
 *
 * A section /wrap folded starts closed under a heading that opens it, a
 * button in the heading as a disclosure (WAI-ARIA APG), so it keeps its place
 * among the headings while it says whether it is open. A block this Postlude
 * can't read has already become its words (`day-report-reader.ts`), so one
 * never breaks the page.
 */

import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { Collapsible } from '#/shared/ui/collapsible.tsx';
import { focusRingClass } from '#/shared/ui/design-classes.ts';
import type {
  ReadBlock,
  ReadDocument,
  ReadSection,
} from '../day-report-reader.ts';
import {
  type BlockProps,
  CalloutView,
  FactsView,
  FallbackView,
  ListView,
  ParagraphView,
  PartsView,
  TableView,
  TilesView,
} from './day-report-blocks.tsx';
import { type Depth, ReportHeading } from './day-report-text.tsx';
import {
  TimelineView,
  type TimelineWidthProps,
} from './day-report-timeline.tsx';

type ViewProps<Block> = BlockProps<Block> & TimelineWidthProps;
type View<Block> = (props: ViewProps<Block>) => ReactNode;

/**
 * One column the width of its container, never wider: a wide timeline is
 * wider than the column, and would otherwise widen the column with it.
 */
const Blocks = ({
  blocks,
  depth,
  ...width
}: {
  readonly blocks: ReadonlyArray<ReadBlock>;
  readonly depth: Depth;
} & TimelineWidthProps) => (
  <div className="grid grid-cols-1 gap-5">
    {blocks.map((block, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: a stored document's blocks never move.
      <BlockView block={block} depth={depth} key={index} {...width} />
    ))}
  </div>
);

const noteClass = 'font-normal font-sans text-ink-muted text-sm';

const SectionView = ({ block, depth, ...width }: ViewProps<ReadSection>) => {
  const [open, setOpen] = useState(block.collapsed !== true);
  const headingId = useId();
  const regionId = useId();
  const blocks = <Blocks blocks={block.blocks} depth={depth + 1} {...width} />;
  const note =
    block.note === undefined ? null : (
      <span className={noteClass}>{block.note}</span>
    );

  if (block.collapsed !== true) {
    return (
      <section aria-labelledby={headingId} className="mt-3">
        <ReportHeading
          className="flex flex-wrap items-baseline gap-x-3"
          depth={depth}
          id={headingId}
        >
          <span>{block.heading}</span>
          {note}
        </ReportHeading>
        <div className="mt-3">{blocks}</div>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="mt-3">
      <ReportHeading depth={depth} id={headingId}>
        <button
          aria-controls={regionId}
          aria-expanded={open}
          className={`group/fold inline-flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 text-left ${focusRingClass}`}
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span>{block.heading}</span>
          {note}
          <ChevronDown
            aria-hidden={true}
            className={`size-4 text-ink-faint transition-transform duration-300 ease-standard motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </ReportHeading>
      <Collapsible id={regionId} open={open}>
        <div className="pt-3">{blocks}</div>
      </Collapsible>
    </section>
  );
};

const views: {
  readonly [Kind in ReadBlock['kind']]: View<
    Extract<ReadBlock, { readonly kind: Kind }>
  >;
} = {
  section: SectionView,
  paragraph: ParagraphView,
  parts: PartsView,
  facts: FactsView,
  list: ListView,
  callout: CalloutView,
  tiles: TilesView,
  timeline: TimelineView,
  table: TableView,
  fallback: FallbackView,
};

const BlockView = ({ block, ...props }: ViewProps<ReadBlock>) => {
  // Each kind's view takes that kind; the map's type checks that it does.
  const BlockKindView = views[block.kind] as View<ReadBlock>;
  return <BlockKindView block={block} {...props} />;
};

export const DayReportView = ({
  document,
  ...width
}: { readonly document: ReadDocument } & TimelineWidthProps) => (
  <Blocks blocks={document.blocks} depth={0} {...width} />
);
