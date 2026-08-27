import { expect, it } from 'bun:test';

import { decodeSaveConfirmation } from './save-confirmation.ts';

it('rejects a non-2xx Response with its safe status and message', async () => {
  const unauthorized = new Response('Not authorized.', { status: 401 });
  let failure: unknown;

  try {
    await decodeSaveConfirmation(unauthorized);
  } catch (error) {
    failure = error;
  }

  expect(failure).toMatchObject({
    message: 'Not authorized.',
    status: 401,
  });
});

it('accepts only a validated database revision', async () => {
  await expect(decodeSaveConfirmation({ revision: 123 })).resolves.toEqual({
    revision: 123,
  });
  await expect(
    decodeSaveConfirmation({ revision: '123' }),
  ).rejects.toBeDefined();
});
