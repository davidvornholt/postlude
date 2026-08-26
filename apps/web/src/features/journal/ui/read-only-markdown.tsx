import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { createElement, type ReactNode } from 'react';

import { journalMarkdownExtensions } from './markdown-extensions.ts';

type ReadOnlyMarkdownProps = {
  readonly className: string;
  readonly markdown: string;
};

const markdownManager = new MarkdownManager({
  extensions: journalMarkdownExtensions(),
});

const uriProtocol = /^[a-z][a-z\d+.-]*:/iu;
const controlCharacterLimit = 0x20;
const deleteControlCharacter = 0x7f;

const hasUnsafeUriCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint < controlCharacterLimit ||
        codePoint === deleteControlCharacter)
    );
  });

const safeHref = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || hasUnsafeUriCharacter(value)) {
    return undefined;
  }
  const href = value.trim();
  if (href === '' || !uriProtocol.test(href)) {
    return href;
  }
  return href.startsWith('https://') || href.startsWith('http://')
    ? href
    : undefined;
};

const childrenOf = (
  node: JSONContent,
  path: string,
): ReadonlyArray<ReactNode> =>
  (node.content ?? []).map((child, position) =>
    renderNode(child, `${path}.${position}`),
  );

const markedText = (node: JSONContent, key: string): ReactNode => {
  let content: ReactNode = node.text ?? '';
  for (const mark of [...(node.marks ?? [])].reverse()) {
    switch (mark.type) {
      case 'bold':
        content = <strong key={key}>{content}</strong>;
        break;
      case 'italic':
        content = <em key={key}>{content}</em>;
        break;
      case 'strike':
        content = <s key={key}>{content}</s>;
        break;
      case 'code':
        content = <code key={key}>{content}</code>;
        break;
      case 'link': {
        const href = safeHref(mark.attrs?.href);
        content =
          href === undefined ? (
            content
          ) : (
            <a href={href} key={key}>
              {content}
            </a>
          );
        break;
      }
      default:
        break;
    }
  }
  return content;
};

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
const firstHeadingLevel = 1;

const headingTag = (
  level: unknown,
): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' => {
  if (typeof level !== 'number') {
    return 'h6';
  }
  return headingTags[level - firstHeadingLevel] ?? 'h6';
};

const renderNode = (node: JSONContent, key: string): ReactNode => {
  const children = childrenOf(node, key);
  switch (node.type) {
    case 'doc':
      return children;
    case 'text':
      return markedText(node, key);
    case 'paragraph':
      return <p key={key}>{children}</p>;
    case 'heading':
      return createElement(headingTag(node.attrs?.level), { key }, children);
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return (
        <ol
          key={key}
          start={typeof node.attrs?.start === 'number' ? node.attrs.start : 1}
        >
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'horizontalRule':
      return <hr key={key} />;
    default:
      return children;
  }
};

/** Safe semantic HTML for the entry while the browser editor is unavailable. */
export const ReadOnlyMarkdown = ({
  className,
  markdown,
}: ReadOnlyMarkdownProps) => (
  <div className={className}>
    {renderNode(markdownManager.parse(markdown), 'doc')}
  </div>
);
