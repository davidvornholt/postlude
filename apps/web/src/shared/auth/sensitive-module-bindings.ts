import {
  bindingsOf,
  type ImportBinding,
  type ModuleBindings,
  resolveSpecifier,
} from './sensitive-module-syntax.ts';

export type ServerFactoryName =
  | 'createFileRoute'
  | 'createMiddleware'
  | 'createServerFn';

type Resolution = 'absent' | 'factory' | 'unknown';

const merge = (resolutions: ReadonlyArray<Resolution>): Resolution => {
  if (resolutions.includes('factory')) {
    return 'factory';
  }
  return resolutions.includes('unknown') ? 'unknown' : 'absent';
};

const markerNamesFor = (
  modules: ReadonlyMap<string, ModuleBindings | undefined>,
  path: string,
  factory: ServerFactoryName,
): ReadonlyArray<string> => {
  const resolveExport = (
    modulePath: string,
    exported: string,
    visited: ReadonlySet<string>,
  ): Resolution => {
    const visit = `${modulePath}\0${exported}`;
    if (visited.has(visit)) {
      return 'unknown';
    }
    const bindings = modules.get(modulePath);
    if (bindings === undefined) {
      return 'unknown';
    }
    const nextVisited = new Set(visited).add(visit);
    const named = bindings.reExports
      .filter((binding) => binding.exported === exported)
      .map((binding) => {
        if (binding.specifier === undefined) {
          const imported = bindings.imports.find(
            ({ local }) => local === binding.imported,
          );
          return imported === undefined
            ? 'absent'
            : resolveImport(modulePath, imported, nextVisited);
        }
        return resolveImport(
          modulePath,
          {
            imported: binding.imported,
            local: binding.exported,
            specifier: binding.specifier,
          },
          nextVisited,
        );
      });
    if (named.length > 0) {
      return merge(named);
    }
    return merge(
      bindings.exportAll.map((specifier) => {
        const target = resolveSpecifier(specifier, modulePath);
        return target === ''
          ? 'unknown'
          : resolveExport(target, exported, nextVisited);
      }),
    );
  };

  const resolveImport = (
    importer: string,
    binding: ImportBinding,
    visited: ReadonlySet<string>,
  ): Resolution => {
    if (binding.imported === factory) {
      return 'factory';
    }
    const target = resolveSpecifier(binding.specifier, importer);
    return target === ''
      ? 'absent'
      : resolveExport(target, binding.imported, visited);
  };

  const bindings = modules.get(path);
  if (bindings === undefined) {
    return [];
  }
  return [
    ...bindings.imports
      .filter((binding) => resolveImport(path, binding, new Set()) !== 'absent')
      .map(({ local }) => local),
    ...bindings.namespaces.flatMap(({ local, specifier }) => {
      const target = resolveSpecifier(specifier, path);
      return target === ''
        ? [`${local}.${factory}`]
        : [...(modules.get(target)?.reExports ?? [])]
            .filter(
              ({ exported }) =>
                resolveExport(target, exported, new Set()) !== 'absent',
            )
            .map(({ exported }) => `${local}.${exported}`);
    }),
  ];
};

/** Builds the module graph once, then resolves local names against it. */
export const serverFactoryNames = (
  modules: ReadonlyArray<{
    readonly code: string;
    readonly path: string;
  }>,
) => {
  const moduleBindings = new Map(
    modules.map((module) => [module.path, bindingsOf(module.code)]),
  );
  return (path: string, factory: ServerFactoryName): ReadonlyArray<string> =>
    markerNamesFor(moduleBindings, path, factory);
};
