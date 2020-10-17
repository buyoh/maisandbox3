import React from 'react';
import { Dispatch } from 'redux';
import { ClientSocket } from '../lib/ClientSocket';
import { RootState, setClientSocket } from '../stores';
import SocketIOClient from 'socket.io-client';
import { connect } from 'react-redux';

type StateProps = {
  // socket: ClientSocket | null,
}

interface DispatchProps {
  setSocket: (socket: ClientSocket) => void
}

type ReactProps = {}

type CombinedProps = ReactProps & StateProps & DispatchProps;

function mapStateToProps(/* state: RootState */): StateProps {
  return {
    // socket: state.clientSocket.value
  };
}

function mapDispatchToProps(dispatch: Dispatch): DispatchProps {
  return {
    setSocket: (socket: ClientSocket) => dispatch(setClientSocket(socket)),
  };
}

type ReactState = {}

class SocketService extends React.Component<CombinedProps, ReactState> {

  constructor(props: CombinedProps) {
    super(props);
    this.state = {};
  }

  componentDidMount(): void {
    this.props.setSocket(new ClientSocket(SocketIOClient()));
  }

  render(): JSX.Element {
    return <></>;
  }
}

export default connect<StateProps, DispatchProps, ReactProps, RootState>(mapStateToProps, mapDispatchToProps)(SocketService);
