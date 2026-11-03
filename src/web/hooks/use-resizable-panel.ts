import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_LOWER_HEIGHT = 80;
const MIN_UPPER_HEIGHT = 100;
const HANDLE_HEIGHT = 6;
const KEYBOARD_STEP = 10;

export interface UseResizablePanelOptions {
  initialHeight: number;
  /** リサイズ可能領域全体を囲むコンテナの ref。高さ計算に使用 */
  containerRef?: React.RefObject<HTMLElement | null>;
}

export interface UseResizablePanelResult {
  lowerHeight: number;
  lowerPanelRef: React.RefObject<HTMLDivElement>;
  isDragging: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * 上下パネル間のリサイズを管理するカスタムフック。
 * ドラッグ中は ref で DOM を直接操作し、pointerup 時に state を確定する。
 */
export function useResizablePanel(
  options: UseResizablePanelOptions
): UseResizablePanelResult {
  const [lowerHeight, setLowerHeight] = useState(options.initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const lowerHeightRef = useRef(options.initialHeight);
  const lowerPanelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // lowerHeight state と ref を同期
  useEffect(() => {
    lowerHeightRef.current = lowerHeight;
  }, [lowerHeight]);

  const getMaxHeight = useCallback((): number => {
    if (options.containerRef?.current) {
      return (
        options.containerRef.current.clientHeight -
        MIN_UPPER_HEIGHT -
        HANDLE_HEIGHT
      );
    }
    return window.innerHeight - MIN_UPPER_HEIGHT - HANDLE_HEIGHT;
  }, [options.containerRef]);

  const clampHeight = useCallback(
    (height: number): number => {
      const maxHeight = getMaxHeight();
      return Math.max(MIN_LOWER_HEIGHT, Math.min(height, maxHeight));
    },
    [getMaxHeight]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    dragStartHeight.current = lowerHeightRef.current;
    isDraggingRef.current = true;
    setIsDragging(true);
    document.body.style.userSelect = 'none';
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = clampHeight(dragStartHeight.current + deltaY);
      if (lowerPanelRef.current) {
        lowerPanelRef.current.style.height = `${newHeight}px`;
      }
    },
    [clampHeight]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = clampHeight(dragStartHeight.current + deltaY);
      setLowerHeight(newHeight);
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.userSelect = '';
    },
    [clampHeight]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setLowerHeight((h) => clampHeight(h + KEYBOARD_STEP));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setLowerHeight((h) => clampHeight(h - KEYBOARD_STEP));
      }
    },
    [clampHeight]
  );

  // ウィンドウリサイズ時にクランプ
  useEffect(() => {
    const onResize = () => {
      setLowerHeight((h) => clampHeight(h));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampHeight]);

  return {
    lowerHeight,
    lowerPanelRef,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  };
}
