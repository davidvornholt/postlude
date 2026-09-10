import Image from '@tiptap/extension-image';

import { imageKeyOf } from './images.ts';

/** Preserve Markdown references, but never load third-party tracking images. */
export const JournalImage = Image.extend({
  parseMarkdown(token, helpers) {
    return helpers.createNode('image', {
      src: token.href,
      title: token.title,
      alt: helpers
        .parseInline(token.tokens ?? [])
        .map((node) => node.text ?? '')
        .join(''),
    });
  },
  renderMarkdown(node) {
    const escapeAlt = (value: unknown) =>
      String(value ?? '')
        .replaceAll(/(?<special>[\\[\]])/gu, '\\$1')
        .replaceAll(/\r?\n/gu, ' ');
    const src = String(node.attrs?.src ?? '');
    const title = node.attrs?.title
      ? ` "${String(node.attrs.title).replaceAll(/(?<special>[\\"])/gu, '\\$1')}"`
      : '';
    return `![${escapeAlt(node.attrs?.alt)}](<${src.replaceAll('>', '%3E').replaceAll('<', '%3C')}>${title})`;
  },
  renderHTML({ node }) {
    const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';
    if (imageKeyOf(node.attrs.src) === undefined) {
      return [
        'span',
        { 'data-unavailable-image': '' },
        alt || 'Image unavailable',
      ];
    }
    return [
      'img',
      { src: node.attrs.src, alt, title: node.attrs.title, loading: 'lazy' },
    ];
  },
});
