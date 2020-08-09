import { QueryData } from '../../../lib/type';

export type Runnable = () => void;
export type ResultEmitter = (data: any) => void;

export interface Task {
  kill(): void;
  startAsync(data: QueryData, jid: any): Promise<any>;
}

export function asyncError(message: string): Promise<boolean> {
  return Promise.reject(new Error(message));
}