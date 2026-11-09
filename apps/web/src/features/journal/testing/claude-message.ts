/**
 * Made-up Claude API replies and errors for tests of the agent note generator.
 */

import Anthropic from '@anthropic-ai/sdk';

/** Text an SDK error might echo from the request, which must go no further. */
export const echoedText =
  'ECHOED-JOURNAL-TEXT Heute war ein langer, guter Tag.';

export const testKey = 'sk-ant-test-0000';

type Block = { readonly type: string; readonly [field: string]: unknown };

export const text = (value: string): Block => ({
  type: 'text',
  text: value,
  citations: null,
});

export const reply = ({
  content,
  stopReason = 'end_turn',
  model = 'claude-sonnet-5-5',
}: {
  readonly content: ReadonlyArray<Block>;
  readonly stopReason?: Anthropic.Beta.BetaStopReason;
  readonly model?: string;
}) =>
  ({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  }) as unknown as Anthropic.Beta.BetaMessage;

export const answer = (value: string) => reply({ content: [text(value)] });

/** The error the SDK throws for this status, as the API would send it. */
export const apiError = (status: number, type: string) =>
  Anthropic.APIError.generate(
    status,
    { type: 'error', error: { type, message: echoedText } },
    undefined,
    new Headers({ 'request-id': `request-${status}` }),
  );
