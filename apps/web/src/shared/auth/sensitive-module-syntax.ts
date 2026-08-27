import { parse } from '@babel/parser';

type Statement = ReturnType<typeof parse>['program']['body'][number];
type ImportDeclaration = Extract<
  Statement,
  { readonly type: 'ImportDeclaration' }
>;
type ExportNamedDeclaration = Extract<
  Statement,
  { readonly type: 'ExportNamedDeclaration' }
>;

export type ImportBinding = {
  readonly imported: string;
  readonly local: string;
  readonly specifier: string;
};

export type ReExportBinding = {
  readonly exported: string;
  readonly imported: string;
  readonly specifier: string | undefined;
};

export type ModuleBindings = {
  readonly imports: ReadonlyArray<ImportBinding>;
  readonly namespaces: ReadonlyArray<{
    readonly local: string;
    readonly specifier: string;
  }>;
  readonly reExports: ReadonlyArray<ReExportBinding>;
  readonly exportAll: ReadonlyArray<string>;
};

/** Where a specifier points, relative to `apps/web/src`; `''` when external. */
export const resolveSpecifier = (
  specifier: string,
  importer: string,
): string => {
  if (specifier.startsWith('#/')) {
    return specifier.slice(2);
  }
  if (!specifier.startsWith('.')) {
    return '';
  }
  const segments = importer.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') {
      segments.pop();
    } else if (part !== '.' && part !== '') {
      segments.push(part);
    }
  }
  return segments.join('/');
};

const nameOf = (node: {
  readonly type: string;
  readonly name?: string;
  readonly value?: unknown;
}): string | undefined => {
  if (node.type === 'Identifier') {
    return node.name;
  }
  return node.type === 'StringLiteral' && typeof node.value === 'string'
    ? node.value
    : undefined;
};

const importsOf = (
  statement: ImportDeclaration,
): ReadonlyArray<ImportBinding> =>
  statement.specifiers.flatMap((binding) => {
    if (binding.type !== 'ImportSpecifier') {
      return [];
    }
    const imported = nameOf(binding.imported);
    return imported === undefined
      ? []
      : [
          {
            imported,
            local: binding.local.name,
            specifier: statement.source.value,
          },
        ];
  });

const namespacesOf = (statement: ImportDeclaration) =>
  statement.specifiers.flatMap((binding) =>
    binding.type === 'ImportNamespaceSpecifier'
      ? [{ local: binding.local.name, specifier: statement.source.value }]
      : [],
  );

const reExportsOf = (
  statement: ExportNamedDeclaration,
): ReadonlyArray<ReExportBinding> =>
  statement.specifiers.flatMap((binding) => {
    if (binding.type !== 'ExportSpecifier') {
      return [];
    }
    const imported = nameOf(binding.local);
    const exported = nameOf(binding.exported);
    return imported === undefined || exported === undefined
      ? []
      : [{ exported, imported, specifier: statement.source?.value }];
  });

export const bindingsOf = (code: string): ModuleBindings | undefined => {
  try {
    const { program } = parse(code, { sourceType: 'module' });
    return {
      imports: program.body.flatMap((statement) =>
        statement.type === 'ImportDeclaration' ? importsOf(statement) : [],
      ),
      namespaces: program.body.flatMap((statement) =>
        statement.type === 'ImportDeclaration' ? namespacesOf(statement) : [],
      ),
      reExports: program.body.flatMap((statement) =>
        statement.type === 'ExportNamedDeclaration'
          ? reExportsOf(statement)
          : [],
      ),
      exportAll: program.body.flatMap((statement) =>
        statement.type === 'ExportAllDeclaration'
          ? [statement.source.value]
          : [],
      ),
    };
  } catch {
    return undefined;
  }
};
