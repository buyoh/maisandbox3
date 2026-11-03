import React from 'react';
import { render } from '@testing-library/react';
import Index from '../../../web/pages/index';

// NOTE: テストはインラインスタイル属性に依存している。
// スタイルを CSS クラスやモジュールに移行した場合、テストの修正が必要。
describe('Index page layout - fullscreen scroll prevention', () => {
  it('root container has overflow: hidden to prevent page scrolling', () => {
    const { container } = render(<Index />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.overflow).toBe('hidden');
  });

  it('main element has minHeight: 0 to allow flex shrinking below content size', () => {
    const { container } = render(<Index />);
    const main = container.querySelector('main') as HTMLElement;
    expect(main.style.minHeight).toBe('0');
  });

  it('CodeEditorShell wrapper has minHeight: 0 to allow flex shrinking', () => {
    const { container } = render(<Index />);
    const main = container.querySelector('main') as HTMLElement;
    // main の最初の子要素が CodeEditorShell のラッパー div
    const editorWrapper = main.firstElementChild as HTMLElement;
    expect(editorWrapper.style.minHeight).toBe('0');
  });

  // overflow-y: scroll を常時適用することで、スクロールバーの表示/非表示による幅変動を防止
  it('lower panel has overflowY: scroll for consistent width', () => {
    const { container } = render(<Index />);
    const lowerPanel = container.querySelector(
      '[data-testid="lower-panel"]'
    ) as HTMLElement;
    expect(lowerPanel.style.overflowY).toBe('scroll');
    expect(lowerPanel.style.overflowX).toBe('hidden');
  });
});
