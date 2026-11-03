import React from 'react';
import { SocketInterface } from './client-socket';

/** TaskStatusListener 用の SocketInterface を提供する React Context */
export const SocketInterfaceContext =
  React.createContext<SocketInterface | null>(null);
