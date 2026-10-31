/**
 * The language the writing is in, as opposed to the interface around it.
 *
 * The chrome is English and the page says so, but the entries and morning notes
 * are German. The browser hyphenates, spell-checks, and reads text aloud by its
 * `lang`, so writing that inherits the page's English is broken at English
 * syllables and pronounced with an English voice. Every element that holds the
 * writer's own words carries this instead. Interface text such as labels,
 * dates, and counts keeps the page's language.
 */
export const journalLanguage = 'de';
