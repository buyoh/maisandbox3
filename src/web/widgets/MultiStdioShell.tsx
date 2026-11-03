import React, { useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useMultiTaskExecution } from '../hooks/use-multi-task-execution';
import { defaultMultiStdioService } from '../services/service-provider';
import {
  stdinListAtom,
  selectedStdinIndexAtom,
  multiBuildResultAtom,
  multiRunResultsAtom,
  addStdinAtom,
  removeStdinAtom,
} from '../stores/multi-stdio-atoms';
import StdinListEditor from '../components/StdinListEditor';
import MultiResultPanel from '../components/MultiResultPanel';

/** Multi-stdio シェルウィジェット。複数 stdin 管理と結果一覧パネルを提供する。 */
export default function MultiStdioShell(): JSX.Element {
  const { run, kill, running } = useMultiTaskExecution(
    defaultMultiStdioService
  );
  const [stdinList, setStdinList] = useAtom(stdinListAtom);
  const [selectedIndex, setSelectedIndex] = useAtom(selectedStdinIndexAtom);
  const buildResult = useAtomValue(multiBuildResultAtom);
  const runResults = useAtomValue(multiRunResultsAtom);
  const addStdin = useSetAtom(addStdinAtom);
  const removeStdin = useSetAtom(removeStdinAtom);

  const handleUpdate = useCallback(
    (index: number, value: string) => {
      setStdinList((prev) => prev.map((s, i) => (i === index ? value : s)));
    },
    [setStdinList]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '4px',
      }}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={run} disabled={running}>
          run
        </button>
        <button onClick={kill} disabled={!running}>
          kill
        </button>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', gap: '8px', minHeight: '150px' }}>
        {/* Left panel: stdin list */}
        <div style={{ minWidth: '150px', maxWidth: '250px' }}>
          <StdinListEditor
            stdinList={stdinList}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onUpdate={handleUpdate}
            onAdd={addStdin}
            onRemove={removeStdin}
          />
        </div>

        {/* Right panel: results */}
        <div
          style={{ flex: 1, borderLeft: '1px solid #ccc', paddingLeft: '8px' }}
        >
          <MultiResultPanel buildResult={buildResult} runResults={runResults} />
        </div>
      </div>
    </div>
  );
}
