import { builtinModules } from 'node:module';

const manifest = await Bun.file(
  new URL('../package.json', import.meta.url),
).json();
const declared = new Set(Object.keys(manifest.dependencies));
const builtins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);
const serverDirectory = new URL('../dist/server/', import.meta.url).pathname;
const scanner = new Bun.Transpiler({ loader: 'js' });
const undeclared = new Set<string>();
const files = [...new Bun.Glob('**/*.js').scanSync(serverDirectory)];
if (files.length === 0) {
  throw new Error('No built server chunks found. Run the web build first.');
}
const sources = await Promise.all(
  files.map((path) => Bun.file(`${serverDirectory}${path}`).text()),
);
for (const source of sources) {
  for (const { path: specifier } of scanner.scanImports(source)) {
    if (
      !(
        specifier.startsWith('.') ||
        specifier.startsWith('/') ||
        builtins.has(specifier)
      )
    ) {
      const segments = specifier.split('/');
      const packageName = specifier.startsWith('@')
        ? segments.slice(0, 2).join('/')
        : segments[0];
      if (packageName === undefined || !declared.has(packageName)) {
        undeclared.add(specifier);
      }
    }
  }
}
if (undeclared.size > 0) {
  throw new Error(
    `Built server imports undeclared runtime packages: ${[...undeclared].sort().join(', ')}`,
  );
}
