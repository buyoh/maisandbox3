import { QueryData } from '../../../lib/type';

export interface TaskInterface {
  kill(): void;
  //languageIdentifier: string;
  startAsync(data: QueryData, jid: any): Promise<void>;

  // configured(): boolean;
  // initialize(data: QueryData, jid: any): Promise<boolean>;
  // build(data: QueryData, jid: any): Promise<boolean>;
  // execute(data: QueryData, jid: any): Promise<boolean>;
  // finalize(): Promise<boolean>;
}
