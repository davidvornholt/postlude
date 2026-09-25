import { expect, it } from 'bun:test';
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import process from 'node:process';
import { spawn } from 'bun';

const packageRoot = new URL('../', import.meta.url).pathname;
const committedMigrations = join(packageRoot, 'drizzle');
const snapshot = async (directory: string): Promise<ReadonlyArray<string>> => {
  const files = (
    await readdir(directory, { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
  return Promise.all(
    files
      .sort()
      .map(
        async (path) =>
          `${path.slice(directory.length)}:${await readFile(path, 'utf8')}`,
      ),
  );
};

it('keeps generated migrations aligned with the authoritative schema', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'postlude-migration-drift-'));
  try {
    const output = join(temporary, 'drizzle');
    await cp(committedMigrations, output, { recursive: true });
    const config = join(temporary, 'drizzle.config.json');
    await writeFile(
      config,
      JSON.stringify({
        dialect: 'postgresql',
        schema: [
          join(packageRoot, 'src/schema.ts'),
          join(packageRoot, 'src/auth-schema.ts'),
        ],
        out: relative(packageRoot, output),
      }),
    );
    const child = spawn(
      [
        process.execPath,
        'run',
        'drizzle-kit',
        'generate',
        `--config=${config}`,
      ],
      {
        cwd: packageRoot,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('No schema changes');
    expect(
      await snapshot(output),
      'Schema changed without committed generated migrations. Run db:generate.',
    ).toEqual(await snapshot(committedMigrations));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
