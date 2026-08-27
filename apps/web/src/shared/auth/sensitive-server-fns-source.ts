/**
 * Call-chain reading for `sensitive-server-fns-scan.ts`, over the JavaScript
 * Bun's transpiler emits for one module.
 */

export type Chain = {
  /** The binding the declaration is assigned to, or `(anonymous)`. */
  readonly name: string;
  /** The whole chain, from the opening name to its last closing paren. */
  readonly text: string;
  /** What each `.middleware(…)` applied directly to the chain was passed. */
  readonly middlewareArguments: ReadonlyArray<string>;
};

const anonymous = '(anonymous)';

const identifierPart = /[$\p{ID_Continue}]/u;
const partOfIdentifier = /[$.\p{ID_Continue}]/u;
const whitespace = /\s/u;

/** Offsets where `name` stands alone rather than inside a longer identifier. */
const identifierOffsets = (
  code: string,
  name: string,
): ReadonlyArray<number> => {
  const offsets: Array<number> = [];
  let from = 0;
  for (;;) {
    const at = code.indexOf(name, from);
    if (at === -1) {
      return offsets;
    }
    from = at + name.length;
    const around = code.slice(at - 1, at) + code.slice(from, from + 1);
    if (!partOfIdentifier.test(around)) {
      offsets.push(at);
    }
  }
};

/** Whether `name` appears in `text` as an identifier of its own. */
export const mentions = (text: string, name: string): boolean =>
  identifierOffsets(text, name).length > 0;

const skipSpace = (code: string, from: number, limit: number): number => {
  let at = from;
  while (at < limit && whitespace.test(code[at])) {
    at += 1;
  }
  return at;
};

/** The offset of the quote closing the string that opens at `open`. */
const stringEnd = (code: string, open: number): number => {
  const quote = code[open];
  for (let at = open + 1; at < code.length; at += 1) {
    if (code[at] === '\\') {
      at += 1;
    } else if (code[at] === quote) {
      return at;
    }
  }
  return code.length;
};

/** The offset of the paren closing the one at `open`; `-1` when unbalanced. */
const closingParen = (code: string, open: number): number => {
  let depth = 0;
  for (let at = open; at < code.length; at += 1) {
    const char = code[at];
    if (char === "'" || char === '"' || char === '`') {
      at = stringEnd(code, at);
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return at;
      }
    }
  }
  return -1;
};

/** Where the member name introduced by the `.` at `dot` ends; `-1` if none. */
const memberEnd = (code: string, dot: number, limit: number): number => {
  let end = dot + 1;
  while (end < limit && identifierPart.test(code[end])) {
    end += 1;
  }
  return end === dot + 1 ? -1 : end;
};

/** The argument list of the call at `from`, or `null` when there is no call. */
const callAt = (code: string, from: number, limit: number) => {
  const close = code[from] === '(' ? closingParen(code, from) : -1;
  return close === -1 || close >= limit
    ? null
    : { argumentList: code.slice(from + 1, close), after: close + 1 };
};

/** The binding a declaration starting at `start` is assigned to. */
const assignedName = (code: string, start: number): string => {
  let at = start - 1;
  while (at >= 0 && whitespace.test(code[at])) {
    at -= 1;
  }
  const assigns =
    code[at] === ':' || (code[at] === '=' && code[at - 1] !== '=');
  if (!assigns) {
    return anonymous;
  }
  at -= 1;
  while (at >= 0 && whitespace.test(code[at])) {
    at -= 1;
  }
  const end = at + 1;
  while (at >= 0 && identifierPart.test(code[at])) {
    at -= 1;
  }
  return end > at + 1 ? code.slice(at + 1, end) : anonymous;
};

/**
 * The call chain hanging off the name at `start`: its own argument list, then
 * every `(…)` and `.member(…)` applied directly to the result. Walking the
 * chain — rather than slicing to the next declaration — is what keeps one
 * declaration's `.middleware([…])` from being credited to an earlier one, and
 * `limit`, where the next declaration begins, is the backstop for text between
 * them that cannot be parsed.
 */
const chainAt = (
  code: string,
  start: number,
  nameLength: number,
  limit: number,
): Chain => {
  const middlewareArguments: Array<string> = [];
  let at = start + nameLength;
  let member = '';
  for (;;) {
    const from = skipSpace(code, at, limit);
    const call = callAt(code, from, limit);
    if (call) {
      if (member === 'middleware') {
        middlewareArguments.push(call.argumentList);
      }
      member = '';
      at = call.after;
    } else {
      const end = code[from] === '.' ? memberEnd(code, from, limit) : -1;
      if (end === -1) {
        break;
      }
      member = code.slice(from + 1, end);
      at = end;
    }
  }
  return {
    name: assignedName(code, start),
    text: code.slice(start, at),
    middlewareArguments,
  };
};

/** Offsets and lengths of the calls to any of `names`, in source order. */
const callsTo = (code: string, names: ReadonlyArray<string>) =>
  names
    .flatMap((name) =>
      identifierOffsets(code, name)
        .filter(
          (offset) =>
            code[skipSpace(code, offset + name.length, code.length)] === '(',
        )
        .map((offset) => ({ offset, length: name.length })),
    )
    .sort((left, right) => left.offset - right.offset);

/**
 * One chain per call to any of `names`. `boundaryNames` are the names that can
 * open a declaration of their own, so a chain never runs past the next one.
 */
export const chainsOf = (
  code: string,
  names: ReadonlyArray<string>,
  boundaryNames: ReadonlyArray<string>,
): ReadonlyArray<Chain> => {
  const boundaries = callsTo(code, boundaryNames).map(({ offset }) => offset);
  return callsTo(code, names).map(({ offset, length }) =>
    chainAt(
      code,
      offset,
      length,
      boundaries.find((boundary) => boundary > offset) ?? code.length,
    ),
  );
};
