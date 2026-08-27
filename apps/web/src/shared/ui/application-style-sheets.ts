import frauncesCss from '@fontsource-variable/fraunces/standard.css?url';
import frauncesItalicCss from '@fontsource-variable/fraunces/standard-italic.css?url';
import interCss from '@fontsource-variable/inter/index.css?url';

// biome-ignore lint/correctness/noUnresolvedImports: Vite turns this canonical app stylesheet into its hashed production asset URL.
import appCss from '../../styles.css?url';

export type ApplicationStyleSheetHrefs = readonly [string, ...Array<string>];

/** The complete ordered stylesheet set for every Postlude document. */
export const applicationStyleSheetHrefs: ApplicationStyleSheetHrefs = [
  interCss,
  frauncesCss,
  frauncesItalicCss,
  appCss,
];
