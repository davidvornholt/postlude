/**
 * The fixture deployment serve-boot.test.ts boots: a sandbox directory shaped
 * like a built app, and the SSR bundles that stand in for one.
 */

import { mkdir, symlink } from 'node:fs/promises';

/** The body the healthy fixture answers anything but a built asset with. */
export const ssrMarker = 'ssr-handled';

export const root = `${Bun.env.TMPDIR ?? '/tmp'}/postlude-boot-${crypto.randomUUID()}`;

const scriptsDir = new URL('.', import.meta.url);
const workspaceModules = Bun.fileURLToPath(
  new URL('../node_modules', scriptsDir),
);

/**
 * Answers both routes the boot self-check asks for: /api/healthz explicitly,
 * and /login through the catch-all below, which is what a rendered page looks
 * like to the check.
 */
export const healthyBundle = `
export default {
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/healthz') return Response.json({ status: 'ok' });
    if (pathname === '/boom') throw new Error('ssr entry blew up');
    return new Response(${JSON.stringify(ssrMarker)} + ' ' + pathname);
  },
};
`;

const bundleAnswering = (statement: string) =>
  `export default { fetch() { ${statement} } };`;

/** What a misconfigured deployment did before the boot self-check existed. */
export const emptyAnswerBundle = bundleAnswering(
  'return new Response(null, { status: 204 });',
);
export const throwingBundle = bundleAnswering(
  "throw new Error('Invalid environment variables');",
);

/**
 * serve.ts resolves dist relative to its own file, so booting it against a
 * fixture dist means running its source from a sandbox that has one. The
 * scripts are copied at test time: an edit to serve.ts changes what every boot
 * test runs.
 */
export const createSandbox = async (
  ssrBundle: string | null,
): Promise<string> => {
  const dir = `${root}/${crypto.randomUUID()}`;
  await Promise.all(
    ['serve.ts', 'server-config.ts'].map((script) =>
      Bun.write(
        `${dir}/scripts/${script}`,
        Bun.file(new URL(script, scriptsDir)),
      ),
    ),
  );
  if (ssrBundle !== null) {
    await Bun.write(`${dir}/dist/server/server.js`, ssrBundle);
  }
  await mkdir(`${dir}/dist/client`, { recursive: true });
  // zod, imported by server-config.ts, resolves from the copied script's path.
  await symlink(workspaceModules, `${dir}/node_modules`);
  return dir;
};
