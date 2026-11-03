import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import StdinListEditor from '../../../web/components/StdinListEditor';

describe('StdinListEditor', () => {
  const defaultProps = {
    stdinList: ['input1', 'input2', 'input3'],
    selectedIndex: 0,
    onSelect: jest.fn(),
    onUpdate: jest.fn(),
    onAdd: jest.fn(),
    onRemove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stdin の件数分リスト項目を表示する', () => {
    const { container } = render(<StdinListEditor {...defaultProps} />);
    const items = container.querySelectorAll('span');
    const labels = Array.from(items).filter((s) =>
      s.textContent?.startsWith('#')
    );
    expect(labels).toHaveLength(3);
  });

  it('リスト項目クリックで onSelect が呼ばれる', () => {
    const { container } = render(<StdinListEditor {...defaultProps} />);
    const items = container.querySelectorAll('[style*="cursor: pointer"]');
    fireEvent.click(items[1]);
    expect(defaultProps.onSelect).toHaveBeenCalledWith(1);
  });

  it('[+ Add] クリックで onAdd が呼ばれる', () => {
    const { getByText } = render(<StdinListEditor {...defaultProps} />);
    fireEvent.click(getByText('+ Add'));
    expect(defaultProps.onAdd).toHaveBeenCalled();
  });

  it('[×] クリックで onRemove が呼ばれる', () => {
    const { getAllByText } = render(<StdinListEditor {...defaultProps} />);
    const removeButtons = getAllByText('×');
    fireEvent.click(removeButtons[0]);
    expect(defaultProps.onRemove).toHaveBeenCalledWith(0);
  });

  it('stdinList が 1 件の場合 [×] ボタンが表示されない', () => {
    const { queryByText } = render(
      <StdinListEditor {...defaultProps} stdinList={['only']} />
    );
    expect(queryByText('×')).toBeNull();
  });

  it('stdinList が 100 件の場合 [+ Add] が disabled', () => {
    const list = Array.from({ length: 100 }, (_, i) => `stdin${i}`);
    const { getByText } = render(
      <StdinListEditor {...defaultProps} stdinList={list} />
    );
    expect((getByText('+ Add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('textarea に選択中の stdin 内容が表示される', () => {
    const { container } = render(
      <StdinListEditor {...defaultProps} selectedIndex={1} />
    );
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('input2');
  });

  it('textarea 変更で onUpdate が呼ばれる', () => {
    const { container } = render(<StdinListEditor {...defaultProps} />);
    const textarea = container.querySelector('textarea')!;
    fireEvent.change(textarea, { target: { value: 'new value' } });
    expect(defaultProps.onUpdate).toHaveBeenCalledWith(0, 'new value');
  });
});
