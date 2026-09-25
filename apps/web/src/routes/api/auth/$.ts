import { createFileRoute } from '@tanstack/react-router';

import { authorizedAuthHandler } from '#/shared/auth/auth.ts';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => authorizedAuthHandler(request),
      POST: ({ request }) => authorizedAuthHandler(request),
    },
  },
});
