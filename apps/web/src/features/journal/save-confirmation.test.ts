import { expect, it } from 'bun:test';

import { decodeSaveConfirmation } from './save-confirmation.ts';

it('rejects a non-2xx Response even when the server call resolved it', async () => {
  const unauthorized = new Response('', { status: 401 });
  let failure: unknown;

  try {
    await decodeSaveConfirmation(unauthorized);
  } catch (error) {
    failure = error;
  }

  expect(failure).toBe(unauthorized);
});

it('accepts only a validated database revision', async () => {
  await expect(decodeSaveConfirmation({ revision: 123 })).resolves.toEqual({
    revision: 123,
  });
  await expect(
    decodeSaveConfirmation({ revision: '123' }),
  ).rejects.toBeDefined();
});
