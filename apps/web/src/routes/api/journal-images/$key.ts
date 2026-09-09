import { createFileRoute } from '@tanstack/react-router';

import { readImageResponse } from '#/features/journal/services/image-response.ts';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';

export const Route = createFileRoute('/api/journal-images/$key')({
  server: {
    middleware: [sessionRequired],
    handlers: { GET: ({ params }) => readImageResponse(params.key) },
  },
});
