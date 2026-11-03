import React from 'react';
import { useAtomValue } from 'jotai';
import { wsStatusAtom, launcherStatusAtom } from '../stores/connection-atoms';
import ConnectionIndicator from '../components/ConnectionIndicator';

/** atoms を読み取り ConnectionIndicator に渡す container widget */
function HeaderConnectionStatus(): JSX.Element {
  const wsStatus = useAtomValue(wsStatusAtom);
  const launcherStatus = useAtomValue(launcherStatusAtom);
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <ConnectionIndicator status={wsStatus} label="WS" />
      <ConnectionIndicator status={launcherStatus} label="Launcher" />
    </div>
  );
}

export default HeaderConnectionStatus;
