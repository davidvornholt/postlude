/**
 * The day report's blocks of words and numbers, one component each: its
 * paragraphs, notes and warnings, the day in parts, facts, lists, tiles and
 * tables, and the fallback a block this Postlude can't read becomes. The
 * section and the timeline have components of their own
 * (`day-report-view.tsx`, `day-report-timeline.tsx`).
 */

import { Info, TriangleAlert } from 'lucide-react';

import { readingMeasureClass } from '#/shared/ui/design-classes.ts';
import { clockOf, clockRange } from '../day-report-format.ts';
import type { FallbackBlock } from '../day-report-reader.ts';
import { tileValueText } from '../day-report-reader.ts';
import type {
  CalloutBlock,
  FactsBlock,
  ItemTime,
  ListBlock,
  ParagraphBlock,
  PartsBlock,
  TableBlock,
  TilesBlock,
} from '../schemas/day-report-blocks.ts';
import { type Depth, ReportHeading, RichText } from './day-report-text.tsx';

export type BlockProps<Block> = {
  readonly block: Block;
  readonly depth: Depth;
};

const proseClass = `${readingMeasureClass} text-ink leading-relaxed`;
const metaClass = 'text-ink-muted text-sm';

export const ParagraphView = ({ block }: BlockProps<ParagraphBlock>) => (
  <p className={proseClass}>
    <RichText text={block.text} />
  </p>
);

export const CalloutView = ({ block }: BlockProps<CalloutBlock>) => {
  const warning = block.tone === 'warning';
  const Icon = warning ? TriangleAlert : Info;
  return (
    <div
      className={[
        readingMeasureClass,
        'flex gap-3 border-l-2 px-4 py-3',
        warning
          ? 'border-critical bg-critical-subtle text-ink'
          : 'border-border-strong text-ink-muted',
      ].join(' ')}
    >
      <Icon aria-hidden={true} className="mt-0.5 shrink-0" size={18} />
      <p className="leading-relaxed">
        <span className="sr-only">{warning ? 'Warning: ' : 'Note: '}</span>
        <RichText text={block.text} />
      </p>
    </div>
  );
};

export const PartsView = ({ block, depth }: BlockProps<PartsBlock>) => (
  <ol className="grid gap-5">
    {block.parts.map((part, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: a stored document's parts never move.
      <li key={index}>
        <ReportHeading
          className="flex flex-wrap items-baseline gap-x-2"
          depth={depth}
        >
          <span
            aria-hidden={true}
            className="inline-flex size-5 shrink-0 items-center justify-center self-center rounded-full bg-surface-sunken font-normal font-sans text-ink-muted text-xs tabular-nums"
          >
            {index + 1}
          </span>
          <span className="sr-only">{`Part ${index + 1}: `}</span>
          {part.title === undefined ? null : <span>{part.title}</span>}
          <span className="font-normal font-sans text-ink-muted text-sm tabular-nums">
            {clockRange(part.start, part.end)}
          </span>
        </ReportHeading>
        <div className="mt-1 grid gap-2 pl-7">
          {part.text.map((paragraph, paragraphIndex) => (
            <p
              className={proseClass}
              // biome-ignore lint/suspicious/noArrayIndexKey: a part's paragraphs never move.
              key={paragraphIndex}
            >
              <RichText text={paragraph} />
            </p>
          ))}
        </div>
      </li>
    ))}
  </ol>
);

export const FactsView = ({ block }: BlockProps<FactsBlock>) => (
  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[7rem_1fr]">
    {block.items.map((item, itemIndex) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: terms may repeat, and stored facts never move.
      <div className="contents" key={itemIndex}>
        <dt className={`${metaClass} sm:pt-0.5`}>{item.term}</dt>
        <dd className="grid gap-1.5">
          {item.details.map((detail, index) => (
            <p
              className={proseClass}
              // biome-ignore lint/suspicious/noArrayIndexKey: a fact's details never move.
              key={index}
            >
              <RichText text={detail} />
            </p>
          ))}
        </dd>
      </div>
    ))}
  </dl>
);

const timeText = (time: ItemTime): string => {
  if ('allDay' in time) {
    return 'All day';
  }
  return 'at' in time ? clockOf(time.at) : clockRange(time.start, time.end);
};

export const ListView = ({ block }: BlockProps<ListBlock>) => {
  const timed = block.items.some((item) => item.time !== undefined);
  return (
    <ul className="divide-y divide-border border-border border-y">
      {block.items.map((item, index) => (
        <li
          className="flex gap-3 py-2 leading-relaxed"
          // biome-ignore lint/suspicious/noArrayIndexKey: a stored list never reorders.
          key={index}
        >
          {timed ? (
            <span className={`${metaClass} w-24 shrink-0 pt-px tabular-nums`}>
              {item.time === undefined ? '' : timeText(item.time)}
            </span>
          ) : null}
          <span className="min-w-0 text-ink">
            <RichText text={item.text} />
            {item.meta === undefined ? null : (
              <span className={metaClass}>{` · ${item.meta}`}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
};

export const TilesView = ({ block }: BlockProps<TilesBlock>) => (
  // biome-ignore lint/a11y/useSemanticElements: a fieldset groups form controls, and these are figures.
  <div aria-label={block.label ?? 'The day in numbers'} role="group">
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
      {block.tiles.map((tile, tileIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: labels may repeat, and stored tiles never move.
        <div className="border border-border px-4 py-3" key={tileIndex}>
          <dt className={metaClass}>{tile.label}</dt>
          <dd
            className={
              tile.value === null
                ? 'mt-1 text-ink-muted text-lg'
                : 'mt-0.5 font-semibold text-2xl text-ink tabular-nums'
            }
          >
            {tileValueText(tile.value)}
          </dd>
          {tile.note === undefined ? null : (
            <dd className="mt-1 text-ink-muted text-xs leading-normal">
              <RichText text={tile.note} />
            </dd>
          )}
        </div>
      ))}
    </dl>
  </div>
);

export const TableView = ({ block }: BlockProps<TableBlock>) => (
  // Scrolls on its own where a table is wider than a phone, so the page doesn't.
  <section
    aria-label={block.caption ?? 'Table'}
    className="overflow-x-auto"
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls has to be reachable by keyboard.
    tabIndex={0}
  >
    <table className="w-full border-collapse text-sm">
      {block.caption === undefined ? null : (
        <caption className={`${metaClass} pb-2 text-left`}>
          {block.caption}
        </caption>
      )}
      <thead>
        <tr>
          {block.columns.map((column, columnIndex) => (
            <th
              className="border-border-strong border-b py-1.5 pr-4 text-left font-normal text-ink-muted"
              // biome-ignore lint/suspicious/noArrayIndexKey: column names may repeat, and columns never move.
              key={columnIndex}
              scope="col"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, rowIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a stored table never reorders.
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td
                className="border-border border-b py-1.5 pr-4 align-top text-ink tabular-nums"
                // biome-ignore lint/suspicious/noArrayIndexKey: cells keep their columns.
                key={cellIndex}
              >
                <RichText text={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

/** A block this Postlude can't draw: its words, plainly. */
export const FallbackView = ({ block }: BlockProps<FallbackBlock>) =>
  block.lines.length === 0 ? null : (
    <div className={`${readingMeasureClass} grid gap-1.5 text-ink-muted`}>
      {block.lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fallback's lines never move.
        <p key={index}>{line}</p>
      ))}
    </div>
  );
