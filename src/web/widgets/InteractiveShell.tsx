import React, { useCallback, useContext, useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useInteractiveExecution } from '../hooks/use-interactive-execution';
import { defaultInteractiveService } from '../services/service-provider';
import { createSocketInteractiveService } from '../services/socket-interactive-service';
import { SocketInterfaceContext } from '../services/socket-interface-context';
import {
  interactiveOutputAtom,
  interactiveInputAtom,
} from '../stores/interactive-atoms';

/** インタラクティブシェルウィジェット。リアルタイム stdin/stdout の UI を提供する。 */
export default function InteractiveShell(): JSX.Element {
  const socketInterface = useContext(SocketInterfaceContext);
  const service = useMemo(
    () =>
      socketInterface
        ? createSocketInteractiveService(socketInterface)
        : defaultInteractiveService,
    [socketInterface]
  );
  const { run, kill, flush, closeStdin, running, stdinClosed } =
    useInteractiveExecution(service);
  const output = useAtomValue(interactiveOutputAtom);
  const [input, setInput] = useAtom(interactiveInputAtom);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        flush();
      }
    },
    [flush]
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

      {/* Output area */}
      <textarea
        readOnly
        value={output.join('')}
        style={{
          fontFamily: 'monospace',
          minHeight: '120px',
          resize: 'vertical',
        }}
      />

      {/* Input area */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!running || stdinClosed}
          placeholder="Enter input (Ctrl+Enter to flush)"
          style={{
            fontFamily: 'monospace',
            flex: 1,
            minHeight: '40px',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button onClick={flush} disabled={!running || stdinClosed}>
            flush
          </button>
          <button onClick={closeStdin} disabled={!running || stdinClosed}>
            EOS
          </button>
        </div>
      </div>
    </div>
  );
}
