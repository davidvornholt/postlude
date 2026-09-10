import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';

import { imageKeyOf } from '../images.ts';
import { ImageViewer } from './image-viewer.tsx';

export const ImageNodeView = ({ node }: NodeViewProps) => {
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';
  const src: unknown = node.attrs.src;
  return (
    <NodeViewWrapper contentEditable={false}>
      {typeof src === 'string' && imageKeyOf(src) !== undefined ? (
        <ImageViewer alt={alt} src={src} />
      ) : (
        <span>{alt || 'Image unavailable'}</span>
      )}
    </NodeViewWrapper>
  );
};
