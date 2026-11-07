/**
 * A made-up morning: a passage noted in the house style ("Psalms 23:1-6"), and
 * a few lines of notes on it. The notes are written in German like the rest of
 * the journal and say nothing about the passage itself, so any of them reads
 * right beside any reference.
 */

import { between, pick, type Random, shuffled } from './sample-random.ts';
import { fillTemplate } from './sample-text.ts';

/** Passages as `formatScriptureReference` writes them. */
export const sampleReferences: ReadonlyArray<string> = [
  'Psalms 23',
  'Psalms 1:1-6',
  'Psalms 42:2-6',
  'Psalms 90:12',
  'Psalms 121:1-8',
  'Psalms 139:1-12',
  'Proverbs 3:5-6',
  'Proverbs 16:1-9',
  'Ecclesiastes 3:1-8',
  'Isaiah 40:28-31',
  'Isaiah 43:1-7',
  'Jeremiah 29:11-14',
  'Lamentations 3:22-24',
  'Micah 6:8',
  'Genesis 12:1-9',
  'Exodus 3:1-15',
  'Ruth 1:16-17',
  '1 Kings 19:9-13',
  'Matthew 5:1-12',
  'Matthew 6:25-34',
  'Matthew 11:28-30',
  'Mark 4:35-41',
  'Luke 10:38-42',
  'Luke 15:11-32',
  'John 1:1-14',
  'John 15:1-8',
  'John 21:1-14',
  'Acts 2:42-47',
  'Romans 8:28-39',
  'Romans 12:9-21',
  '1 Corinthians 13',
  '2 Corinthians 4:16-18',
  'Galatians 5:22-23',
  'Ephesians 3:14-21',
  'Philippians 4:4-9',
  'Colossians 3:12-17',
  'Hebrews 12:1-3',
  'James 1:2-8',
  '1 Peter 5:6-11',
  '1 John 4:7-21',
];

const noteSentences: ReadonlyArray<string> = [
  'Beim {ersten|zweiten|langsamen} Lesen ist mir {ein einzelner Vers|die Ruhe im Text|die Wiederholung am Anfang} aufgefallen.',
  'Hängen geblieben ist der Gedanke, dass {Vertrauen kein Gefühl ist, sondern eine Richtung|Geduld etwas mit Hoffnung zu tun hat|ich nicht alles allein tragen muss}.',
  'Ich nehme mir für heute vor, {freundlicher zu antworten, auch wenn es eng wird|einmal öfter innezuhalten|mehr zuzuhören als zu reden}.',
  'Der Text passt {erstaunlich gut zu dieser Woche|zu dem Gespräch von gestern|gerade nicht leicht in meinen Kopf}.',
  'Eine Frage nehme ich mit: {Wovor habe ich eigentlich Angst?|Wem kann ich heute etwas Gutes tun?|Was davon gilt wirklich mir?}',
  'Mit dem Kaffee am Fenster gelesen, {während es draußen noch dunkel war|bevor alle anderen wach waren|mit Lea auf dem Schoß}.',
  'Zum Weiterdenken: {wie sich Dankbarkeit im Alltag zeigt|was Frieden mitten in der Arbeit heißt|warum Stille so schwer auszuhalten ist}.',
];

const shortestNote = 2;
const longestNote = 3;

export const sampleReference = (random: Random): string =>
  pick(random, sampleReferences);

/** Two or three sentences, about forty words. */
export const sampleMorningNotes = (random: Random): string =>
  shuffled(random, noteSentences)
    .slice(0, between(random, shortestNote, longestNote))
    .map((template) => fillTemplate(random, template))
    .join(' ');
