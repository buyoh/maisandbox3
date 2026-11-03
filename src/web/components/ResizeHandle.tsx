import React from 'react';
import styles from './ResizeHandle.module.css';

const MIN_LOWER_HEIGHT = 80;
const MAX_LOWER_HEIGHT = 800;

export interface ResizeHandleProps {
  isDragging: boolean;
  lowerHeight: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/** 上下パネル間のドラッグ可能なリサイズハンドル。 */
export default function ResizeHandle(props: ResizeHandleProps): JSX.Element {
  const className = [styles.handle, props.isDragging ? styles.active : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      role="separator"
      aria-orientation="horizontal"
      aria-valuenow={props.lowerHeight}
      aria-valuemin={MIN_LOWER_HEIGHT}
      aria-valuemax={MAX_LOWER_HEIGHT}
      aria-label="パネルサイズ調整"
      tabIndex={0}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onKeyDown={props.onKeyDown}
      data-testid="resize-handle"
    />
  );
}
