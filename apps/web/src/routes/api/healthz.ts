import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';

import { sqlClientLayer } from '#/shared/db/database.ts';
import { makeDatabaseCheck } from '#/shared/health/database-health.ts';

const serviceUnavailable = 503;
const headers = { 'cache-control': 'no-store' };

const isDatabaseAvailable = makeDatabaseCheck((check) =>
  Effect.runPromise(check.pipe(Effect.provide(sqlClientLayer))),
);

/**
 * Health probe for the container, the release switch and the host's deploy
 * check. It answers 200 only while the database answers, because no page can
 * load a journal entry without it. A failure carries no details, since the
 * route is public.
 */
export const Route = createFileRoute('/api/healthz')({
  server: {
    handlers: {
      GET: async () =>
        (await isDatabaseAvailable())
          ? Response.json({ status: 'ok' }, { headers })
          : new Response(null, { status: serviceUnavailable, headers }),
    },
  },
});
