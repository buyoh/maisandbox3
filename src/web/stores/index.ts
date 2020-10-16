import { createStore, combineReducers } from 'redux';
import { codeEditorReducer } from './CodeEditor/reducers';

export const rootReducer = combineReducers({
  codeEditor: codeEditorReducer,
});

export const rootStore = createStore(rootReducer);

export type RootState = ReturnType<typeof rootReducer>
