import { renderHook, act } from '@testing-library/react';
import { useResizablePanel } from '../../../web/hooks/use-resizable-panel';

describe('useResizablePanel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
    document.body.style.userSelect = '';
  });

  it('returns initial height from options', () => {
    const { result } = renderHook(() =>
      useResizablePanel({ initialHeight: 200 })
    );
    expect(result.current.lowerHeight).toBe(200);
    expect(result.current.isDragging).toBe(false);
  });

  it('adjusts height on ArrowUp key', () => {
    const { result } = renderHook(() =>
      useResizablePanel({ initialHeight: 200 })
    );

    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowUp',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.lowerHeight).toBe(210);
  });

  it('adjusts height on ArrowDown key', () => {
    const { result } = renderHook(() =>
      useResizablePanel({ initialHeight: 200 })
    );

    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowDown',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.lowerHeight).toBe(190);
  });

  it('clamps height at minimum on ArrowDown', () => {
    const { result } = renderHook(() =>
      useResizablePanel({ initialHeight: 85 })
    );

    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowDown',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.lowerHeight).toBe(80);
  });

  it('clamps height at maximum on ArrowUp', () => {
    // maxHeight = 800 - 100 - 6 = 694
    const { result } = renderHook(() =>
      useResizablePanel({ initialHeight: 690 })
    );

    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowUp',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.lowerHeight).toBe(694);
  });

  it('clamps height when window resizes', () => {
    const { result } = renderHook(() =>
      useResizablePanel({ initialHeight: 600 })
    );

    act(() => {
      Object.defineProperty(window, 'innerHeight', { value: 300 });
      window.dispatchEvent(new Event('resize'));
    });

    // maxHeight = 300 - 100 - 6 = 194
    expect(result.current.lowerHeight).toBe(194);
  });

  it('ignores non-arrow keys', () => {
    const { result } = renderHook(() =>
      useResizablePanel({ initialHeight: 200 })
    );

    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.lowerHeight).toBe(200);
  });

  describe('pointer drag flow', () => {
    function createPointerEvent(overrides: Record<string, unknown>) {
      const capturedPointers = new Set<number>();
      return {
        pointerId: 1,
        clientY: 0,
        currentTarget: {
          setPointerCapture: (id: number) => capturedPointers.add(id),
          releasePointerCapture: (id: number) => capturedPointers.delete(id),
        },
        ...overrides,
        _capturedPointers: capturedPointers,
      } as unknown as React.PointerEvent;
    }

    it('sets isDragging on pointerDown and clears on pointerUp', () => {
      const { result } = renderHook(() =>
        useResizablePanel({ initialHeight: 200 })
      );

      act(() => {
        result.current.handlePointerDown(createPointerEvent({ clientY: 300 }));
      });
      expect(result.current.isDragging).toBe(true);
      expect(document.body.style.userSelect).toBe('none');

      act(() => {
        result.current.handlePointerUp(createPointerEvent({ clientY: 280 }));
      });
      expect(result.current.isDragging).toBe(false);
      expect(document.body.style.userSelect).toBe('');
    });

    it('updates lowerHeight based on drag delta on pointerUp', () => {
      const { result } = renderHook(() =>
        useResizablePanel({ initialHeight: 200 })
      );

      act(() => {
        result.current.handlePointerDown(createPointerEvent({ clientY: 300 }));
      });

      // ドラッグ中: clientY が下に移動 = deltaY は負 = 高さ縮小
      act(() => {
        result.current.handlePointerUp(createPointerEvent({ clientY: 350 }));
      });

      // deltaY = 300 - 350 = -50, newHeight = 200 + (-50) = 150
      expect(result.current.lowerHeight).toBe(150);
    });

    it('updates lowerHeight when dragging up (increasing lower panel)', () => {
      const { result } = renderHook(() =>
        useResizablePanel({ initialHeight: 200 })
      );

      act(() => {
        result.current.handlePointerDown(createPointerEvent({ clientY: 300 }));
      });

      act(() => {
        result.current.handlePointerUp(createPointerEvent({ clientY: 250 }));
      });

      // deltaY = 300 - 250 = 50, newHeight = 200 + 50 = 250
      expect(result.current.lowerHeight).toBe(250);
    });

    it('clamps height during drag to minimum', () => {
      const { result } = renderHook(() =>
        useResizablePanel({ initialHeight: 100 })
      );

      act(() => {
        result.current.handlePointerDown(createPointerEvent({ clientY: 300 }));
      });

      act(() => {
        result.current.handlePointerUp(createPointerEvent({ clientY: 500 }));
      });

      // deltaY = 300 - 500 = -200, newHeight = 100 + (-200) = -100 → clamped to 80
      expect(result.current.lowerHeight).toBe(80);
    });

    it('ignores pointerMove when not dragging', () => {
      const { result } = renderHook(() =>
        useResizablePanel({ initialHeight: 200 })
      );

      // pointerMove without prior pointerDown should not crash
      act(() => {
        result.current.handlePointerMove(createPointerEvent({ clientY: 250 }));
      });

      expect(result.current.lowerHeight).toBe(200);
    });
  });
});
