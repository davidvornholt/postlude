/**
 * A streak, stated plainly. The card is bound like the day leaf but with the
 * band reduced to a rule, so the two cards read as pages from the same book
 * without competing with the number they carry.
 */

import { BindingRule } from '#/features/design-comparison/ui/heirloom/binding-strip.tsx';
import { Card } from '#/features/design-comparison/ui/heirloom/card.tsx';
import {
  displayHeadingClass,
  labelClass,
} from '#/features/design-comparison/ui/heirloom/heirloom-classes.ts';

export const StatCard = ({
  days,
  label,
}: {
  readonly days: number;
  readonly label: string;
}) => (
  <Card className="flex">
    <BindingRule />
    <div className="px-5 py-5 sm:px-6">
      <p className={labelClass}>{label}</p>
      <p
        className={[displayHeadingClass, 'mt-2 flex items-baseline gap-2'].join(
          ' ',
        )}
      >
        <span className="text-4xl">{days}</span>
        <span className="text-base text-ink-muted">days in a row</span>
      </p>
    </div>
  </Card>
);
