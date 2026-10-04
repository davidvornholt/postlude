import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

import { protectedCallErrorAdapter } from '#/shared/auth/protected-call-error.ts';

// Declaring a start instance replaces TanStack's implicit CSRF check for server
// functions, so the same same-origin check is declared here explicitly.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  serializationAdapters: [protectedCallErrorAdapter],
}));
