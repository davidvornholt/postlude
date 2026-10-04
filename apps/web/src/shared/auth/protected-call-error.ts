import { createSerializationAdapter } from '@tanstack/react-router';
import { Schema } from 'effect';

const protectedCallErrorWireFields = {
  message: Schema.String,
  status: Schema.Number,
};

/**
 * A vetted failure from the authenticated server-function boundary. `message`
 * is safe to show, and `status` is the HTTP status the browser reads to choose
 * a recovery action, such as offering sign-in again after a 401. `cause` keeps
 * the vetted Response on the server for diagnostics; it is never serialized.
 */
export class ProtectedCallError extends Schema.TaggedError<ProtectedCallError>()(
  'ProtectedCallError',
  {
    ...protectedCallErrorWireFields,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

type ProtectedCallErrorWire = Schema.Struct.Type<
  typeof protectedCallErrorWireFields
>;

/** Reads a vetted boundary Response into the error a browser caller receives. */
export const protectedCallErrorFrom = async (
  response: Response,
): Promise<ProtectedCallError> =>
  new ProtectedCallError({
    message: await response.text(),
    status: response.status,
    cause: response,
  });

/**
 * TanStack Start serializes any other Error as `new Error(message)`, which
 * would drop `status`. This adapter sends only the public message and status,
 * and the browser rebuilds the error through its validating constructor. The
 * stack, cause, and any other server detail stay on the server.
 */
export const protectedCallErrorAdapter = createSerializationAdapter({
  key: 'postlude/protected-call-error',
  test: (value: unknown): value is ProtectedCallError =>
    value instanceof ProtectedCallError,
  toSerializable: ({
    message,
    status,
  }: ProtectedCallError): ProtectedCallErrorWire => ({ message, status }),
  fromSerializable: ({ message, status }: ProtectedCallErrorWire) =>
    new ProtectedCallError({ message, status }),
});
