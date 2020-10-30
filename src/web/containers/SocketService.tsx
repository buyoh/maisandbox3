import React from 'react';
import { Dispatch } from 'redux';
import { SocketInterface, ClientSocket } from '../lib/ClientSocket';
import { RootState, setClientSocket } from '../stores';
import SocketIOClient from 'socket.io-client';
import { connect } from 'react-redux';

class Socket implements SocketInterface {
  private socket: SocketIOClient.Socket;
  private emitEvent: string;
  private recieveEvent: string;

  constructor(
    socket: SocketIOClient.Socket,
    emitEvent: string,
    recieveEvent: string
  ) {
    this.socket = socket;
    this.emitEvent = emitEvent;
    this.recieveEvent = recieveEvent;
  }
  emit(data: any): void {
    this.socket.emit(this.emitEvent, data);
  }
  onRecieve(handler: (data: any) => void): void {
    this.socket.on(this.recieveEvent, handler);
  }
}

type StateProps = {
  // socket: ClientSocket | null,
};

interface DispatchProps {
  setSocket: (socket: ClientSocket) => void;
}

type ReactProps = {};

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

type ReactState = {};

class SocketService extends React.Component<CombinedProps, ReactState> {
  constructor(props: CombinedProps) {
    super(props);
    this.state = {};
  }

  componentDidMount(): void {
    const io = SocketIOClient();
    this.props.setSocket(
      new ClientSocket(new Socket(io, 'c2e_Exec', 's2c_ResultExec'))
    );
  }

  render(): JSX.Element {
    return <></>;
  }
}

export default connect<StateProps, DispatchProps, ReactProps, RootState>(
  mapStateToProps,
  mapDispatchToProps
)(SocketService);
