import { describe, expect, it } from 'bun:test';

import { agentNoteCharacterLimit } from './agent-note-prompt.ts';
import { agentNoteTextOf } from './agent-note-text.ts';

describe('the note as stored', () => {
  it('keeps plain text as it is', () => {
    const answer =
      'Du hast deine Energie als erschöpft bewertet.\n\nDie Fokuszeit war hoch.';
    expect(agentNoteTextOf(answer)).toBe(answer);
  });

  it('takes out Markdown marks and web addresses', () => {
    const answer = [
      '## Notiz',
      '- **Energie:** niedrig, aber `180` Minuten Fokus.',
      '1. Siehe [Bericht](https://example.test/report) und https://example.test/x.',
      '> Zitat',
      '![Bild](https://example.test/image.png)',
    ].join('\n');
    expect(agentNoteTextOf(answer)).toBe(
      [
        'Notiz',
        'Energie: niedrig, aber 180 Minuten Fokus.',
        'Siehe Bericht und .',
        'Zitat',
      ].join('\n'),
    );
  });

  it('removes control characters and collapses blank lines', () => {
    expect(agentNoteTextOf('Eins.\r\n\r\n\r\n\u0007Zwei.\u0000')).toBe(
      'Eins.\n\nZwei.',
    );
  });

  it('cuts a long answer at the last sentence that fits', () => {
    const sentence = 'Das ist ein Satz mit etwas Inhalt. ';
    const answer = sentence.repeat(
      Math.ceil((agentNoteCharacterLimit * 2) / sentence.length),
    );
    const note = agentNoteTextOf(answer);
    expect(note?.length).toBeLessThanOrEqual(agentNoteCharacterLimit);
    expect(note?.endsWith('Inhalt.')).toBe(true);
  });

  it('is no note when nothing is left or no sentence ends early enough', () => {
    expect(agentNoteTextOf('')).toBeUndefined();
    expect(agentNoteTextOf('**  **\n\n`` ``')).toBeUndefined();
    expect(agentNoteTextOf('a'.repeat(agentNoteCharacterLimit + 1))).toBe(
      undefined,
    );
  });
});
