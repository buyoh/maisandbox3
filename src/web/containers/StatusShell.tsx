import React from 'react';
import { RootState } from '../stores';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import { Item as StatusBarItem } from '../components/StatusBar';
import * as Actions from '../stores/Status/actions'; // TODO: separate
import StatusBar from '../components/StatusBar';
import StatusDetail from '../components/StatusDetail';
import { ReportItem } from '../../lib/ResultTypes';

// TODO: typeフォルダのようなものを作ってそこに移すべき
export interface ExecResult {
  color: string;
  summary: string;
  log: string;
  details: ReportItem[] | null;
}

type StateProps = {
  statuses: Array<StatusBarItem>;
  activatedStatusKey: number;
  activatedStatusDetail: ReportItem[] | null;
};

interface DispatchProps {
  activateResult: (idx: number) => void;
}

type ReactProps = {};

type CombinedProps = ReactProps & StateProps & DispatchProps;

function mapStateToProps(state: RootState): StateProps {
  // TODO: detach from staticIO
  const activatedResultIndex = state.status.activatedResultIndex;
  return {
    statuses: state.status.results
      .map((r, i) => ({
        color: r.color,
        text: r.summary,
        key: '' + i,
        onClick: undefined, // renderで挿入する
      }))
      .reverse(),
    activatedStatusKey:
      activatedResultIndex === null ? -1 : activatedResultIndex,
    activatedStatusDetail:
      activatedResultIndex === null
        ? null
        : state.status.results[activatedResultIndex].details,
  };
}

function mapDispatchToProps(dispatch: Dispatch): DispatchProps {
  return {
    // setSocket: (socket: ClientSocket) => dispatch(setClientSocket(socket)),
    activateResult: (idx: number) => dispatch(Actions.activateResult(idx)),
  };
}

type ReactState = {};

class StatusShell extends React.Component<CombinedProps, ReactState> {
  constructor(props: CombinedProps) {
    super(props);
    this.state = {};
  }

  render(): JSX.Element {
    return (
      <>
        <div className="flex-elem-fix">
          <StatusBar
            values={this.props.statuses.map((e) => ({
              ...e,
              onClick: () => this.props.activateResult(+e.key),
            }))}
            active={'' + this.props.activatedStatusKey}
          />
        </div>
        <div className="flex-elem-fix">
          {this.props.activatedStatusDetail ? (
            <StatusDetail details={this.props.activatedStatusDetail} />
          ) : (
            <></>
          )}
        </div>
      </>
    );
  }
}

export default connect<StateProps, DispatchProps, ReactProps, RootState>(
  mapStateToProps,
  mapDispatchToProps
)(StatusShell);
