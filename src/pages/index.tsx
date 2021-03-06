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
      <div>
        <Meta />
        <BackupService />
        <SocketService />
        <Header />
        <main>
          <div className="flex_row">
            <div className="flex_elem">
              <CodeEditorShell />
            </div>
          </div>

          <div>
            <PanelGroup>
              <StaticIOShell key="file stdio" />
              <SingleTaskShell key="single task" />
            </PanelGroup>
            <StatusShell />
          </div>
        </main>
      </div>
    );
  }
}
