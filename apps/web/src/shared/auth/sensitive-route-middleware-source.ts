import { parseExpression } from '@babel/parser';

const handlerMethods = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const;

type ParsedExpression = ReturnType<typeof parseExpression>;
type ObjectExpression = Omit<
  Extract<ParsedExpression, { readonly type: 'ObjectExpression' }>,
  'comments' | 'errors' | 'tokens'
>;
type ObjectMember = ObjectExpression['properties'][number];
type NamedMember = Exclude<ObjectMember, { readonly type: 'SpreadElement' }>;

type PropertyResolution =
  | { readonly state: 'absent' }
  | { readonly state: 'ambiguous' }
  | { readonly state: 'found'; readonly member: NamedMember };

export type RouteServerConfiguration = {
  /** `null` means the effective handler object could not be proven. */
  readonly handlers: ReadonlyArray<string> | null;
  /** The effective `server.middleware` array elements as source text. */
  readonly middlewareArguments: ReadonlyArray<string>;
};

const absent = { state: 'absent' } as const;
const ambiguous = { state: 'ambiguous' } as const;

const propertyName = (property: NamedMember): string | undefined => {
  if (property.computed) {
    return undefined;
  }
  const { key } = property;
  if (key.type === 'Identifier') {
    return key.name;
  }
  if (key.type === 'StringLiteral') {
    return key.value;
  }
  return undefined;
};

/**
 * Resolves the value JavaScript leaves on an object after its properties and
 * inline spreads run from left to right. A later explicit property makes an
 * earlier unknown spread irrelevant. A later unknown or computed property can
 * still replace the requested name, so the scan refuses to guess.
 */
const propertyResolution = (
  member: ObjectMember,
  name: string,
): PropertyResolution => {
  if (member.type === 'SpreadElement') {
    return member.argument.type === 'ObjectExpression'
      ? effectiveProperty(member.argument, name)
      : ambiguous;
  }
  const memberName = propertyName(member);
  if (memberName === undefined) {
    return ambiguous;
  }
  return memberName === name ? { state: 'found', member } : absent;
};

const effectiveProperty = (
  object: ObjectExpression,
  name: string,
): PropertyResolution => {
  for (let index = object.properties.length - 1; index >= 0; index -= 1) {
    const member = object.properties[index];
    if (member === undefined) {
      return ambiguous;
    }
    const resolution = propertyResolution(member, name);
    if (resolution.state !== 'absent') {
      return resolution;
    }
  }
  return absent;
};

const objectValue = (
  resolution: PropertyResolution,
): ObjectExpression | null | undefined => {
  if (resolution.state === 'absent') {
    return undefined;
  }
  if (
    resolution.state === 'ambiguous' ||
    resolution.member.type !== 'ObjectProperty' ||
    resolution.member.value.type !== 'ObjectExpression'
  ) {
    return null;
  }
  return resolution.member.value;
};

const handlersOf = (server: ObjectExpression): ReadonlyArray<string> | null => {
  const handlers = objectValue(effectiveProperty(server, 'handlers'));
  if (handlers === undefined || handlers === null) {
    return null;
  }
  const names: Array<string> = [];
  for (const method of handlerMethods) {
    const handler = effectiveProperty(handlers, method);
    if (handler.state === 'ambiguous') {
      return null;
    }
    if (handler.state === 'found') {
      names.push(method);
    }
  }
  return names.length === 0 ? null : names;
};

const middlewareOf = (
  routeChain: string,
  server: ObjectExpression,
): ReadonlyArray<string> | null => {
  const middleware = effectiveProperty(server, 'middleware');
  if (middleware.state === 'absent') {
    return [];
  }
  if (
    middleware.state === 'ambiguous' ||
    middleware.member.type !== 'ObjectProperty' ||
    middleware.member.value.type !== 'ArrayExpression'
  ) {
    return null;
  }
  const { elements } = middleware.member.value;
  if (
    elements.some(
      (element) =>
        element === null ||
        element.type === 'SpreadElement' ||
        element.start === null ||
        element.end === null,
    )
  ) {
    return null;
  }
  return elements.map((element) =>
    routeChain.slice(element?.start ?? 0, element?.end ?? 0),
  );
};

const unreadable = (): RouteServerConfiguration => ({
  handlers: null,
  middlewareArguments: [],
});

/** Reads the effective final route `server` object and fails closed on doubt. */
export const routeServerConfiguration = (
  routeChain: string,
): RouteServerConfiguration => {
  let declaration: ParsedExpression;
  try {
    declaration = parseExpression(routeChain);
  } catch {
    return unreadable();
  }
  if (declaration.type !== 'CallExpression') {
    return unreadable();
  }
  const [options] = declaration.arguments;
  if (options?.type !== 'ObjectExpression') {
    return unreadable();
  }
  const server = objectValue(effectiveProperty(options, 'server'));
  if (server === undefined) {
    return { handlers: [], middlewareArguments: [] };
  }
  if (server === null) {
    return unreadable();
  }
  const handlers = handlersOf(server);
  const middlewareArguments = middlewareOf(routeChain, server);
  if (handlers === null || middlewareArguments === null) {
    return unreadable();
  }
  return { handlers, middlewareArguments };
};
