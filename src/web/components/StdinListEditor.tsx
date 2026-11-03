import React from 'react';

export interface StdinListEditorProps {
  stdinList: string[];
  selectedIndex: number;
  onSelect(index: number): void;
  onUpdate(index: number, value: string): void;
  onAdd(): void;
  onRemove(index: number): void;
}

/** Stdin リスト管理コンポーネント。左パネルにリスト・下部に選択中 stdin の編集エリアを表示する。 */
export default function StdinListEditor({
  stdinList,
  selectedIndex,
  onSelect,
  onUpdate,
  onAdd,
  onRemove,
}: StdinListEditorProps): JSX.Element {
  const canAdd = stdinList.length < 100;
  const canRemove = stdinList.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {stdinList.map((_, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 4px',
              cursor: 'pointer',
              backgroundColor: index === selectedIndex ? '#e0e0ff' : undefined,
            }}
            onClick={() => onSelect(index)}
          >
            <span>#{index + 1}</span>
            {canRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(index);
                }}
                style={{ marginLeft: 'auto', fontSize: '0.8em' }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={onAdd} disabled={!canAdd}>
        + Add
      </button>
      <textarea
        value={stdinList[selectedIndex] ?? ''}
        onChange={(e) => onUpdate(selectedIndex, e.target.value)}
        placeholder={`stdin #${selectedIndex + 1}`}
        style={{
          fontFamily: 'monospace',
          minHeight: '60px',
          resize: 'vertical',
        }}
      />
    </div>
  );
}
