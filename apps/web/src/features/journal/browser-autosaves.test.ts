import { expect, it } from 'bun:test';

import { AutosaveSettlementError } from './autosave-registry.ts';
import { navigateAfterAutosavesSettle } from './browser-autosaves.ts';

it('names the day that prevented navigation without running the read', async () => {
  let navigated = false;
  const result = await navigateAfterAutosavesSettle(
    () =>
      Promise.reject(
        new AutosaveSettlementError({
          date: '2025-11-02',
          failure: { kind: 'network', message: 'Saving failed.' },
          message: 'Saving failed.',
        }),
      ),
    () => {
      navigated = true;
      return Promise.resolve();
    },
  );

  expect(result).toEqual({ _tag: 'blocked', date: '2025-11-02' });
  expect(navigated).toBe(false);
});

it('does not turn an unexpected settlement defect into a blocked navigation', async () => {
  const defect = new TypeError('broken settlement');

  await expect(
    navigateAfterAutosavesSettle(
      () => Promise.reject(defect),
      () => Promise.resolve(),
    ),
  ).rejects.toBe(defect);
});

it('navigates only after every autosave settles', async () => {
  const order: Array<string> = [];

  const result = await navigateAfterAutosavesSettle(
    () => {
      order.push('settled');
      return Promise.resolve();
    },
    () => {
      order.push('navigated');
      return Promise.resolve();
    },
  );

  expect(result).toEqual({ _tag: 'navigated' });
  expect(order).toEqual(['settled', 'navigated']);
});
