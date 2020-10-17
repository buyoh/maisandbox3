import { createStore, combineReducers } from 'redux';
import { ClientSocket } from '../lib/ClientSocket';
import { codeEditorReducer } from './CodeEditor/reducers';
import { staticIOReducer } from './StaticIO/reducers';
import { createStorageReducer } from './util/storageReducer';

const clientSocketRedux = createStorageReducer<ClientSocket | null>('clientSocket', null);
export const setClientSocket = clientSocketRedux.method.setStorage;

export const rootReducer = combineReducers({
  codeEditor: codeEditorReducer,
  staticIO: staticIOReducer,
  clientSocket: clientSocketRedux.reducer
});

export const rootStore = createStore(rootReducer);

export type RootState = ReturnType<typeof rootReducer>
