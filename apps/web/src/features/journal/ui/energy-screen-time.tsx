/**
 * The screen time on the days that felt fresh, okay, or drained, side by side.
 * It sets two things the journal already holds beside each other and draws no
 * conclusion from them: a writer who sees that drained days ran two hours
 * longer at the screen can decide for themselves what that means.
 *
 * Only days measured under the newest metrics version are averaged, as every
 * screen-time total is, and a feeling without a measured day is left out
 * rather than shown as no time at all.
 */

import { energyOptions, ratingStepOf } from '../evening-labels.ts';
import { durationLabel, energyLabel } from '../insights-labels.ts';
import type { EnergyScreenTime } from '../insights-patterns.ts';
import { journalNumberLabel } from '../journal-labels.ts';
import { RatingSwatch } from './rating-swatch.tsx';

export const EnergyScreenTimeTable = ({
  rows,
}: {
  readonly rows: ReadonlyArray<EnergyScreenTime>;
}) => (
  <table className="w-full max-w-xl border-collapse text-sm">
    <caption className="sr-only">
      Average screen time on the days rated at each energy
    </caption>
    <thead>
      <tr className="text-ink-faint">
        <th className="py-2 pr-4 text-left font-normal" scope="col">
          Felt
        </th>
        <th className="py-2 pr-4 text-right font-normal" scope="col">
          Days
        </th>
        <th className="py-2 pr-4 text-right font-normal" scope="col">
          At the screen
        </th>
        <th className="py-2 text-right font-normal" scope="col">
          Focused
        </th>
      </tr>
    </thead>
    <tbody>
      {[...rows].reverse().map((row) => (
        <tr className="border-border border-t" key={row.energy}>
          <th className="py-2 pr-4 text-left font-normal text-ink" scope="row">
            <span className="flex items-center gap-2">
              <RatingSwatch step={ratingStepOf(energyOptions, row.energy)} />
              {energyLabel(row.energy)}
            </span>
          </th>
          <td className="py-2 pr-4 text-right text-ink-muted tabular-nums">
            {journalNumberLabel(row.days)}
          </td>
          <td className="py-2 pr-4 text-right text-ink tabular-nums">
            {durationLabel(row.activeMinutes)}
          </td>
          <td className="py-2 text-right text-ink-muted tabular-nums">
            {row.focusMinutes === undefined
              ? 'Not measured'
              : durationLabel(row.focusMinutes)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
