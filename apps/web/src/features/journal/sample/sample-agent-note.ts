/**
 * A made-up agent note for a rated day. Real notes are written in the
 * journal's language and speak to David directly, so these are German and say
 * "du". They go through `agentNoteTextOf` like a model's answer does, so a
 * sample note is stored exactly as a real one would be.
 */

import { agentNoteTextOf } from '../agent-note-text.ts';
import type { DayRating, Progress } from '../schemas/day-rating.ts';
import { pick, type Random } from './sample-random.ts';
import { fillTemplate } from './sample-text.ts';

export const agentNoteModel = 'Postlude preview sample';

type Rated = Pick<DayRating, 'energy' | 'progress' | 'repeatDay'>;

const energyLines = {
  drained: [
    'Du warst heute ziemlich erschöpft, und nach dieser Woche ist das kein Wunder.',
    'Heute war wenig Kraft da. Das darf auch einmal so sein.',
  ],
  okay: [
    'Deine Energie lag heute im Mittelfeld, ohne große Ausschläge.',
    'Du bist ruhig und gleichmäßig durch den Tag gekommen.',
  ],
  fresh: [
    'Du bist heute mit viel Schwung durch den Tag gegangen.',
    'Heute hattest du spürbar Energie, schon am Vormittag.',
  ],
} as const;

/** A list rather than an object, because `a_lot` is no property name. */
const progressLines: ReadonlyArray<{
  readonly progress: Progress;
  readonly lines: ReadonlyArray<string>;
}> = [
  {
    progress: 'little',
    lines: [
      'Vorangekommen bist du nur wenig, aber nicht jeder Tag muss etwas abliefern.',
      'Es ist nicht viel fertig geworden. Vielleicht lag das eher an den Umständen als an dir.',
    ],
  },
  {
    progress: 'solid',
    lines: [
      'Du bist ordentlich vorangekommen, Schritt für Schritt.',
      'Was du dir vorgenommen hattest, hast du zum großen Teil geschafft.',
    ],
  },
  {
    progress: 'a_lot',
    lines: [
      'Du hast heute richtig viel geschafft.',
      'Es war ein Tag, an dem vieles auf einmal fertig geworden ist.',
    ],
  },
];

const repeatLines = {
  yes: [
    'Diesen Tag würdest du so wiederholen. Merk dir, was ihn getragen hat.',
  ],
  partly: ['Einiges davon würdest du wieder so machen, anderes lieber nicht.'],
  no: [
    'So einen Tag willst du nicht noch einmal, und das ist eine ehrliche Antwort.',
  ],
} as const;

const suggestions: ReadonlyArray<string> = [
  'Vielleicht hilft morgen {ein kurzer Spaziergang nach dem Mittagessen|ein früherer Feierabend|eine feste Stunde ohne Nachrichten}.',
  'Für morgen könnte {eine kurze Liste am Morgen|ein ruhiger Start ohne Termine|ein Anruf bei jemandem, der dir guttut} reichen.',
  'Gönn dir heute Abend {etwas Ruhe|ein Kapitel in deinem Buch|einen Tee auf dem Balkon}, bevor der nächste Tag beginnt.',
];

/** Three or four sentences on the day, as the note would be stored. */
export const sampleAgentNote = (random: Random, rating: Rated): string => {
  const lines = [
    rating.energy === null
      ? undefined
      : pick(random, energyLines[rating.energy]),
    rating.progress === null
      ? undefined
      : pick(
          random,
          progressLines.find(({ progress }) => progress === rating.progress)
            ?.lines ?? [],
        ),
    rating.repeatDay === null
      ? undefined
      : pick(random, repeatLines[rating.repeatDay]),
    fillTemplate(random, pick(random, suggestions)),
  ].filter((line) => line !== undefined);
  const note = agentNoteTextOf(lines.join(' '));
  if (note === undefined) {
    throw new TypeError('A sample note must be one Postlude can store.');
  }
  return note;
};
