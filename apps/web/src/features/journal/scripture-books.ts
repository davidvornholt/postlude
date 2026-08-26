/**
 * The sixty-six books, in canonical order, with the name Postlude shows and the
 * name bibleserver.com wants in a URL.
 *
 * Two names because they are two different jobs. The interface is English, so a
 * reference reads "Proverbs 12:5-13" the way the app's own copy does. The
 * passage opens in the NeÜ, which is German, and bibleserver addresses its books
 * by their German names — so "Sprüche" is what goes in the link. Every German
 * name here was checked against the live site: each one loads its own book
 * rather than falling back, which is what bibleserver does silently with a name
 * it does not know.
 *
 * `aliases` is what a reference can be typed as. Both languages are accepted
 * because the writer reads a German bible and thinks in English at a keyboard,
 * and matching folds case, dots, and spaces away (see `scripture-reference.ts`),
 * so "1 Cor", "1.Kor", and "1kor" all arrive here as the same lookup and none of
 * them needs its own entry.
 *
 * The order is the order of the bible, and `index` is taken from it. Sorting a
 * list of references by book means sorting by that number.
 */

export type ScriptureBook = {
  /** How Postlude writes it. */
  readonly english: string;
  /** The path segment bibleserver.com addresses it by. */
  readonly german: string;
  /** Extra spellings a writer may type, beyond the two names above. */
  readonly aliases: ReadonlyArray<string>;
};

export const scriptureBooks: ReadonlyArray<ScriptureBook> = [
  { english: 'Genesis', german: '1.Mose', aliases: ['Gen', 'Gn', '1Mo'] },
  { english: 'Exodus', german: '2.Mose', aliases: ['Ex', 'Exod', '2Mo'] },
  { english: 'Leviticus', german: '3.Mose', aliases: ['Lev', 'Lv', '3Mo'] },
  { english: 'Numbers', german: '4.Mose', aliases: ['Num', 'Nm', '4Mo'] },
  {
    english: 'Deuteronomy',
    german: '5.Mose',
    aliases: ['Deut', 'Dt', '5Mo'],
  },
  { english: 'Joshua', german: 'Josua', aliases: ['Josh', 'Jos'] },
  { english: 'Judges', german: 'Richter', aliases: ['Judg', 'Ri'] },
  { english: 'Ruth', german: 'Rut', aliases: ['Rt'] },
  { english: '1 Samuel', german: '1.Samuel', aliases: ['1Sam', '1Sa'] },
  { english: '2 Samuel', german: '2.Samuel', aliases: ['2Sam', '2Sa'] },
  { english: '1 Kings', german: '1.Könige', aliases: ['1Kgs', '1Ki', '1Kön'] },
  { english: '2 Kings', german: '2.Könige', aliases: ['2Kgs', '2Ki', '2Kön'] },
  {
    english: '1 Chronicles',
    german: '1.Chronik',
    aliases: ['1Chr', '1Ch'],
  },
  {
    english: '2 Chronicles',
    german: '2.Chronik',
    aliases: ['2Chr', '2Ch'],
  },
  { english: 'Ezra', german: 'Esra', aliases: ['Ezr'] },
  { english: 'Nehemiah', german: 'Nehemia', aliases: ['Neh', 'Ne'] },
  { english: 'Esther', german: 'Ester', aliases: ['Esth', 'Est'] },
  { english: 'Job', german: 'Hiob', aliases: ['Jb', 'Hi'] },
  { english: 'Psalms', german: 'Psalm', aliases: ['Ps', 'Psalm', 'Psalmen'] },
  {
    english: 'Proverbs',
    german: 'Sprüche',
    aliases: ['Prov', 'Prv', 'Spr'],
  },
  {
    english: 'Ecclesiastes',
    german: 'Prediger',
    aliases: ['Eccl', 'Qoh', 'Pred'],
  },
  {
    english: 'Song of Songs',
    german: 'Hoheslied',
    aliases: ['Song', 'Sos', 'Canticles', 'Hld', 'Hohelied'],
  },
  { english: 'Isaiah', german: 'Jesaja', aliases: ['Isa', 'Is', 'Jes'] },
  { english: 'Jeremiah', german: 'Jeremia', aliases: ['Jer', 'Jr'] },
  {
    english: 'Lamentations',
    german: 'Klagelieder',
    aliases: ['Lam', 'Klgl', 'Klag'],
  },
  { english: 'Ezekiel', german: 'Hesekiel', aliases: ['Ezek', 'Ez', 'Hes'] },
  { english: 'Daniel', german: 'Daniel', aliases: ['Dan', 'Dn'] },
  { english: 'Hosea', german: 'Hosea', aliases: ['Hos', 'Ho'] },
  { english: 'Joel', german: 'Joel', aliases: ['Jl'] },
  { english: 'Amos', german: 'Amos', aliases: ['Am'] },
  { english: 'Obadiah', german: 'Obadja', aliases: ['Obad', 'Ob'] },
  { english: 'Jonah', german: 'Jona', aliases: ['Jon'] },
  { english: 'Micah', german: 'Micha', aliases: ['Mic', 'Mi'] },
  { english: 'Nahum', german: 'Nahum', aliases: ['Nah', 'Na'] },
  { english: 'Habakkuk', german: 'Habakuk', aliases: ['Hab', 'Hb'] },
  { english: 'Zephaniah', german: 'Zefanja', aliases: ['Zeph', 'Zep', 'Zef'] },
  { english: 'Haggai', german: 'Haggai', aliases: ['Hag', 'Hg'] },
  {
    english: 'Zechariah',
    german: 'Sacharja',
    aliases: ['Zech', 'Zec', 'Sach'],
  },
  { english: 'Malachi', german: 'Maleachi', aliases: ['Mal', 'Ml'] },
  { english: 'Matthew', german: 'Matthäus', aliases: ['Matt', 'Mt'] },
  { english: 'Mark', german: 'Markus', aliases: ['Mk', 'Mr'] },
  { english: 'Luke', german: 'Lukas', aliases: ['Lk', 'Lu'] },
  { english: 'John', german: 'Johannes', aliases: ['Jn', 'Joh'] },
  {
    english: 'Acts',
    german: 'Apostelgeschichte',
    aliases: ['Ac', 'Apg'],
  },
  { english: 'Romans', german: 'Römer', aliases: ['Rom', 'Rm', 'Röm'] },
  {
    english: '1 Corinthians',
    german: '1.Korinther',
    aliases: ['1Cor', '1Co', '1Kor'],
  },
  {
    english: '2 Corinthians',
    german: '2.Korinther',
    aliases: ['2Cor', '2Co', '2Kor'],
  },
  { english: 'Galatians', german: 'Galater', aliases: ['Gal', 'Ga'] },
  { english: 'Ephesians', german: 'Epheser', aliases: ['Eph'] },
  {
    english: 'Philippians',
    german: 'Philipper',
    aliases: ['Phil', 'Php', 'Phil'],
  },
  { english: 'Colossians', german: 'Kolosser', aliases: ['Col', 'Kol'] },
  {
    english: '1 Thessalonians',
    german: '1.Thessalonicher',
    aliases: ['1Thess', '1Th', '1Thes'],
  },
  {
    english: '2 Thessalonians',
    german: '2.Thessalonicher',
    aliases: ['2Thess', '2Th', '2Thes'],
  },
  {
    english: '1 Timothy',
    german: '1.Timotheus',
    aliases: ['1Tim', '1Ti'],
  },
  {
    english: '2 Timothy',
    german: '2.Timotheus',
    aliases: ['2Tim', '2Ti'],
  },
  { english: 'Titus', german: 'Titus', aliases: ['Tit', 'Tt'] },
  { english: 'Philemon', german: 'Philemon', aliases: ['Phlm', 'Phm'] },
  { english: 'Hebrews', german: 'Hebräer', aliases: ['Heb', 'Hebr', 'Hbr'] },
  { english: 'James', german: 'Jakobus', aliases: ['Jas', 'Jak'] },
  { english: '1 Peter', german: '1.Petrus', aliases: ['1Pet', '1Pe', '1Petr'] },
  { english: '2 Peter', german: '2.Petrus', aliases: ['2Pet', '2Pe', '2Petr'] },
  { english: '1 John', german: '1.Johannes', aliases: ['1Jn', '1Jo', '1Joh'] },
  { english: '2 John', german: '2.Johannes', aliases: ['2Jn', '2Jo', '2Joh'] },
  { english: '3 John', german: '3.Johannes', aliases: ['3Jn', '3Jo', '3Joh'] },
  { english: 'Jude', german: 'Judas', aliases: ['Jud', 'Jd'] },
  {
    english: 'Revelation',
    german: 'Offenbarung',
    aliases: ['Rev', 'Rv', 'Offb', 'Apocalypse'],
  },
];
