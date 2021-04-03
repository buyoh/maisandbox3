export interface StaticIOState {
  stdin: string;
  stdout: string;
}

export const K_A_UPDATE_STDIN = 'staticio/stdin/update';

interface ActionUpdateStdin {
  type: typeof K_A_UPDATE_STDIN;
  stdin: string;
}

export const K_A_UPDATE_STDOUT = 'staticio/stdout/update';

interface ActionUpdateStdout {
  type: typeof K_A_UPDATE_STDOUT;
  stdout: string;
}

export type StaticIOActionTypes = ActionUpdateStdin | ActionUpdateStdout;
