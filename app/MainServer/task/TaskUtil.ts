export type Runnable = () => void;
export type ResultEmitter = (data: any) => void;

export function getWorkDirectory() {
  return 'var';
}

export function asyncError(message) {
  return Promise.reject(new Error(message));
}