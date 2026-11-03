import React from 'react';
import { ClientSocket } from './client-socket';

/** ClientSocket インスタンスを提供する React Context */
export const SocketContext = React.createContext<ClientSocket | null>(null);
