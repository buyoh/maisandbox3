import { QueryData } from '../../../lib/type';

export type Runnable = () => void;
export type ResultEmitter = (data: any) => void;

export interface Task {
  kill(): void;
  startAsync(data: QueryData, jid: any): Promise<any>;
};

export function getWorkDirectory() {
  return 'var';
}

export function asyncError(message) {
  return Promise.reject(new Error(message));
}