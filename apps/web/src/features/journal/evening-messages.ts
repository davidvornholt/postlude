/**
 * What the server says when it refuses an evening action, and what it stores
 * when no note generator is set up.
 *
 * They live here rather than beside the code that raises them so the page can
 * recognise them without importing anything that talks to the database: the
 * day page explains a refusal in its own words and gives the not-configured
 * note its own, calmer wording.
 */

export const futureDayMessage =
  'This day has not begun yet, so it cannot be rated or closed.';

export const dayClosedMessage =
  'This day is closed. Reopen it to change its ratings.';

export const ratingsNeededMessage =
  'Rate energy and progress before closing the day.';

export const closedDayNeededMessage =
  'Close the day before asking for a new note.';

export const notConfiguredMessage =
  'No agent note generator is set up yet, so no note was written.';
