import { expect, it } from 'bun:test';

import { decodeSaveConfirmation } from './save-confirmation.ts';

it('accepts only a validated database revision', async () => {
  await expect(decodeSaveConfirmation({ revision: 123 })).resolves.toEqual({
    revision: 123,
  });
  await expect(
    decodeSaveConfirmation({ revision: '123' }),
  ).rejects.toBeDefined();
});
