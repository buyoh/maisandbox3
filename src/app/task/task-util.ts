import { TaskResult } from '../../interfaces/result-types';

/** タスクの TaskResult 送信コールバック型 */
export type ResultEmitter = (data: TaskResult) => void;

/** 副作用なしの関数型 */
export type Runnable = () => void;
