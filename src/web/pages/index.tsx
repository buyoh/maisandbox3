import React, { useRef } from 'react';
import Header from '../components/Header';
import ResizeHandle from '../components/ResizeHandle';

import CodeEditorShell from '../widgets/CodeEditorShell';
import StaticIOShell from '../widgets/StaticIOShell';
import InteractiveShell from '../widgets/InteractiveShell';
import MultiStdioShell from '../widgets/MultiStdioShell';
import PanelGroup from '../widgets/PanelGroup';
import StatusShell from '../widgets/StatusShell';
import { useSessionBackup } from '../hooks/use-session-backup';
import { useSocket } from '../hooks/use-socket';
import { useConnectionStatus } from '../hooks/use-connection-status';
import { useResizablePanel } from '../hooks/use-resizable-panel';
import { SocketContext } from '../services/socket-context';
import { SocketInterfaceContext } from '../services/socket-interface-context';
import SessionSidebar from '../widgets/SessionSidebar';
import { sidebarOpenAtom } from '../stores/session-atoms';
import { activePanelTabAtom } from '../stores/status-atoms';
import { useSetAtom } from 'jotai';

export default function Index(): JSX.Element {
  useSessionBackup();
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const setActivePanelTab = useSetAtom(activePanelTabAtom);
  const { clientSocket, events, socketInterface } = useSocket();
  useConnectionStatus(events);
  const mainRef = useRef<HTMLElement>(null);
  const {
    lowerHeight,
    lowerPanelRef,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  } = useResizablePanel({ initialHeight: 200, containerRef: mainRef });

  return (
    <SocketContext.Provider value={clientSocket}>
      <SocketInterfaceContext.Provider value={socketInterface}>
        <div
          className="flex-column"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden',
          }}
        >
          <Header />
          <div
            className="flex-elem-fix"
            style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 8px', background: '#2a2a2a' }}
          >
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title="セッション一覧"
              data-testid="sidebar-toggle"
              style={{ background: 'none', border: '1px solid #555', color: '#aaa', cursor: 'pointer', padding: '2px 8px', fontSize: '0.85em' }}
            >
              🕐 セッション
            </button>
          </div>
          <SessionSidebar />
          <main
            ref={mainRef}
            className="flex-elem flex-column"
            style={{
              margin: '1rem',
              minHeight: 0,
            }}
          >
            <div className="flex-elem flex-row" style={{ minHeight: 0 }}>
              <CodeEditorShell />
            </div>

            <ResizeHandle
              isDragging={isDragging}
              lowerHeight={lowerHeight}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onKeyDown={handleKeyDown}
            />

            <div
              ref={lowerPanelRef}
              className="flex-column"
              data-testid="lower-panel"
              style={{
                height: `${lowerHeight}px`,
                flexShrink: 0,
                overflowY: 'scroll',
                overflowX: 'hidden',
              }}
            >
              <PanelGroup
                tabs={[
                  { key: 'file stdio', content: <StaticIOShell /> },
                  { key: 'interactive', content: <InteractiveShell /> },
                  { key: 'multi stdio', content: <MultiStdioShell /> },
                ]}
                onTabChange={setActivePanelTab}
              />
              <StatusShell />
            </div>
          </main>
        </div>
      </SocketInterfaceContext.Provider>
    </SocketContext.Provider>
  );
}
