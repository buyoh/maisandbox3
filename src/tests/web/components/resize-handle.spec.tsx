import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ResizeHandle from '../../../web/components/ResizeHandle';

describe('ResizeHandle', () => {
  const defaultProps = {
    isDragging: false,
    lowerHeight: 200,
    onPointerDown: jest.fn(),
    onPointerMove: jest.fn(),
    onPointerUp: jest.fn(),
    onKeyDown: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with separator role and ARIA attributes', () => {
    const { getByTestId } = render(<ResizeHandle {...defaultProps} />);
    const handle = getByTestId('resize-handle');
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
    expect(handle.getAttribute('aria-valuenow')).toBe('200');
    expect(handle.getAttribute('aria-valuemin')).toBe('80');
    expect(handle.getAttribute('aria-label')).toBe('パネルサイズ調整');
    expect(handle.getAttribute('tabindex')).toBe('0');
  });

  it('calls onPointerDown when pointer is pressed', () => {
    const { getByTestId } = render(<ResizeHandle {...defaultProps} />);
    const handle = getByTestId('resize-handle');
    fireEvent.pointerDown(handle, { clientY: 100 });
    expect(defaultProps.onPointerDown).toHaveBeenCalledTimes(1);
  });

  it('calls onPointerMove when pointer moves', () => {
    const { getByTestId } = render(<ResizeHandle {...defaultProps} />);
    const handle = getByTestId('resize-handle');
    fireEvent.pointerMove(handle, { clientY: 110 });
    expect(defaultProps.onPointerMove).toHaveBeenCalledTimes(1);
  });

  it('calls onPointerUp when pointer is released', () => {
    const { getByTestId } = render(<ResizeHandle {...defaultProps} />);
    const handle = getByTestId('resize-handle');
    fireEvent.pointerUp(handle, { clientY: 110 });
    expect(defaultProps.onPointerUp).toHaveBeenCalledTimes(1);
  });

  it('calls onKeyDown for keyboard events', () => {
    const { getByTestId } = render(<ResizeHandle {...defaultProps} />);
    const handle = getByTestId('resize-handle');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(defaultProps.onKeyDown).toHaveBeenCalledTimes(1);
  });
});
