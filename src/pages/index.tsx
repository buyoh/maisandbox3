import React from 'react';

import Meta from '../web/components/style/meta';
import Header from '../web/components/Header';

import CodeEditorShell from '../web/containers/CodeEditorShell';
import StaticIOShell from '../web/containers/StaticIOShell';
import BackupService from '../web/containers/BackupService';
import SocketService from '../web/containers/SocketService';
import PanelGroup from '../web/components/PanelGroup';
import SingleTaskShell from '../web/containers/SingleTaskShell';
import StatusShell from '../web/containers/StatusShell';

export default class Index extends React.Component<{}, {}> {
  constructor(props: {}) {
    super(props);
  }

  render(): JSX.Element {
    return (
      <div
        className="flex_cols"
        style={{
          // TODO: name 'BodyWrapper'
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'auto',
        }}
      >
        <Meta />
        <BackupService />
        <SocketService />
        <Header />
        <main
          className="flex_elem flex_cols"
          style={
            // TODO: name 'MainFrame' // ダサいか？
            {
              margin: '1rem',
            }
          }
        >
          <div className="flex_elem flex_row">
            <CodeEditorShell />
          </div>

          <div className="flex_elem_fix">
            <PanelGroup>
              <StaticIOShell key="file stdio" />
              <SingleTaskShell key="single task" />
            </PanelGroup>
            <StatusShell />
          </div>
        </main>
        {/* <div style={{ height: '75vh' }}></div> */}
      </div>
    );
  }
}
