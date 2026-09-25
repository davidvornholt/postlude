import { expect, it } from 'bun:test';
import { account, session, user, verification } from '@postlude/db/auth-schema';
import { migrateGeneratedThrough } from '@postlude/db/migrate';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { makeSignature } from 'better-auth/crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Effect } from 'effect';
import { openTestDatabase } from '#/shared/testing/test-database';
import { createAuthorizedAuthHandler } from './auth-handler';
import { createAuthOptions } from './auth-options';

const clientError = 400;
const unauthorized = 401;
const success = 200;
const secret = 'auth-integration-public-fixture-secret-123456';
const origin = 'http://localhost:3100';
const allowedId = '123';
const schema = { account, session, user, verification };

it('real Better Auth rejects reads and mutations after account drift and still serves valid sessions', async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const pool = yield* openTestDatabase((database) =>
          migrateGeneratedThrough(database, '0008_free_mindworm'),
        );
        yield* Effect.tryPromise(async () => {
          const client = await pool.connect();
          await client.query('begin');
          try {
            const auth = betterAuth({
              ...createAuthOptions({
                allowedGitHubAccountId: allowedId,
                baseURL: origin,
                githubClientId: 'fixture-client',
                githubClientSecret: 'fixture-client-secret',
                secret,
              }),
              database: drizzleAdapter(drizzle(client, { schema }), {
                provider: 'pg',
              }),
            });
            const handler = createAuthorizedAuthHandler({
              api: auth.api,
              handler: auth.handler,
              allowedAccountId: allowedId,
            });
            const id = crypto.randomUUID();
            await client.query(
              'insert into "user" (id,name,email) values ($1,$2,$3)',
              [id, 'Owner', `${id}@example.test`],
            );
            await client.query(
              'insert into account (id,issuer,account_id,provider_id,user_id) values ($1,$2,$3,$4,$5)',
              [id, 'https://github.com', allowedId, 'github', id],
            );
            const createHeaders = async () => {
              const token = crypto.randomUUID();
              await client.query(
                "insert into session (id,token,user_id,expires_at) values ($1,$2,$3,now()+interval '1 hour')",
                [token, token, id],
              );
              return new Headers({
                cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}`,
                origin,
                'content-type': 'application/json',
              });
            };
            const headers = await createHeaders();
            const valid = await handler(
              new Request(`${origin}/api/auth/get-session`, { headers }),
            );
            expect(valid.status).toBe(success);
            expect((await valid.json()).user.id).toBe(id);
            await client.query('update account set account_id=$1 where id=$2', [
              '999',
              id,
            ]);
            for (const endpoint of [
              'get-session',
              'list-accounts',
              'list-sessions',
              'update-user',
            ]) {
              // biome-ignore lint/performance/noAwaitInLoops: Each probe needs a fresh session after the previous one was revoked.
              const driftHeaders = await createHeaders();
              const result = await handler(
                new Request(`${origin}/api/auth/${endpoint}`, {
                  headers: driftHeaders,
                  ...(endpoint === 'update-user'
                    ? {
                        method: 'POST',
                        body: JSON.stringify({ name: 'Forbidden mutation' }),
                      }
                    : {}),
                }),
              );
              expect(result.status).toBe(unauthorized);
            }
            const renamed = await client.query(
              'select name from "user" where id=$1',
              [id],
            );
            expect(renamed.rows[0].name).toBe('Owner');
            const sessions = await client.query(
              'select count(*)::int as count from session where user_id=$1',
              [id],
            );
            // The original valid-session probe remains; each drift probe revoked its own token.
            expect(sessions.rows[0].count).toBe(1);
            const callback = await handler(
              new Request(
                `${origin}/api/auth/callback/github?error=access_denied`,
              ),
            );
            expect(callback.status).toBeLessThan(clientError);
          } finally {
            await client.query('rollback');
            client.release();
          }
        });
      }),
    ),
  );
});
