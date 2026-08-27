import { parseExpression } from '@babel/parser';

const propertyNameIs = (
  property: { readonly computed: boolean; readonly key: unknown },
  name: string,
): boolean => {
  if (property.computed) {
    return false;
  }
  const key = property.key as
    | { readonly type: 'Identifier'; readonly name: string }
    | { readonly type: 'StringLiteral'; readonly value: string };
  return (
    (key.type === 'Identifier' && key.name === name) ||
    (key.type === 'StringLiteral' && key.value === name)
  );
};

/** Reads only `routeOptions.server.middleware`, never a similarly named decoy. */
export const routeServerMiddlewareArguments = (
  routeChain: string,
): ReadonlyArray<string> => {
  const declaration = parseExpression(routeChain);
  if (declaration.type !== 'CallExpression') {
    return [];
  }
  const [options] = declaration.arguments;
  if (options?.type !== 'ObjectExpression') {
    return [];
  }
  const server = options.properties.find(
    (property) =>
      property.type === 'ObjectProperty' && propertyNameIs(property, 'server'),
  );
  if (
    server?.type !== 'ObjectProperty' ||
    server.value.type !== 'ObjectExpression'
  ) {
    return [];
  }
  const middleware = server.value.properties.find(
    (property) =>
      property.type === 'ObjectProperty' &&
      propertyNameIs(property, 'middleware'),
  );
  if (
    middleware?.type !== 'ObjectProperty' ||
    middleware.value.type !== 'ArrayExpression'
  ) {
    return [];
  }
  return middleware.value.elements.flatMap((element) =>
    element?.start === null || element?.end === null || element === null
      ? []
      : [routeChain.slice(element.start, element.end)],
  );
};
