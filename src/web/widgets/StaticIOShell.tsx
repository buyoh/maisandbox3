import React, { useState, useCallback, useContext } from 'react';
import { useAtom, useAtomValue } from 'jotai';

import TextArea from '../components/Textarea';
import Button from '../components/Button';
import { stdinAtom, stdoutAtom } from '../stores/static-io-atoms';
import { activeTaskErrlogAtom } from '../stores/status-atoms';
import { ClientSocket } from '../services/client-socket';
import { SocketContext } from '../services/socket-context';
import { useTaskExecution } from '../hooks/use-task-execution';

// - - - - -

export interface StaticIOShellProps {
  /** テスト用: socket を外部から注入 */
  socket?: ClientSocket | null;
}

/**
 * stdin/stdout の入出力パネルおよびタスク実行ボタンを含むウィジェット。
 * タスク実行ロジックは useTaskExecution に委譲する。
 */
export function StaticIOShell(props: StaticIOShellProps): JSX.Element {
  const socketFromContext = useContext(SocketContext);
  const socket = props.socket !== undefined ? props.socket : socketFromContext;

  const [stdin, updateStdin] = useAtom(stdinAtom);
  const [stdout, updateStdout] = useAtom(stdoutAtom);
  const errlogVal = useAtomValue(activeTaskErrlogAtom);

  const { run, kill } = useTaskExecution(socket);
  const [visibleErr, setVisibleErr] = useState(false);

  const handleClickToggle = useCallback(() => {
    setVisibleErr((v) => !v);
  }, []);

  return (
    <div className="flex-elem flex-column">
      <div className="flex-elem flex-row">
        <div className="flex-elem-fix flex-column">
          <div className="flex-elem-fix">
            <Button data-testid="button-run" onClick={run} key="btn-run">
              run
            </Button>
          </div>
          <div className="flex-elem-fix">
            <Button data-testid="button-kill" onClick={kill} key="btn-kill">
              kill
            </Button>
          </div>
          <div className="flex-elem-fix">
            <Button
              data-testid="button-toggle-display"
              onClick={handleClickToggle}
              key="btn-toggle-display"
            >
              IO/Err
            </Button>
          </div>
        </div>
        {visibleErr ? (
          <div className="flex-elem flex-row" style={{ overflow: 'hidden' }}>
            <TextArea
              placeholder="stderr"
              key="inp-err"
              value={errlogVal}
              readOnly={true}
            />
          </div>
        ) : (
          <div className="flex-elem flex-row" style={{ overflow: 'hidden' }}>
            <div className="flex-elem-fix flex-column">
              <TextArea
                placeholder="stdin"
                key="inp-in"
                value={stdin}
                resizable="horizontal"
                onChange={updateStdin}
              />
            </div>
            <div className="flex-elem flex-column">
              <TextArea
                placeholder="stdout"
                key="inp-out"
                value={stdout}
                onChange={updateStdout}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StaticIOShell;
