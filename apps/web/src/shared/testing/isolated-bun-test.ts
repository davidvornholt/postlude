import { spawnSync } from 'bun';

const bunGlobal: unknown = Reflect.get(globalThis, 'Bun');
const currentWorkingDirectory =
  typeof bunGlobal === 'object' && bunGlobal !== null && 'cwd' in bunGlobal
    ? bunGlobal.cwd
    : undefined;

export const isIsolatedBunTestProcess = (directory: string): boolean =>
  currentWorkingDirectory === directory;

export const runIsolatedBunTest = (path: string, directory: string): void => {
  const probe = spawnSync({
    cmd: ['bun', 'test', path],
    cwd: directory,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (probe.exitCode !== 0) {
    throw new Error(
      `The isolated Bun test failed.\n${probe.stdout.toString()}\n${probe.stderr.toString()}`,
    );
  }
};
