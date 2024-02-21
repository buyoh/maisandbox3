import { QueryInitInfo } from '../../interfaces/QueryTypes';

export interface TaskInterface {
  kill(): void;
  //languageIdentifier: string;
  startAsync(data: QueryInitInfo): Promise<void>;

  // configured(): boolean;
  // initialize(data: QueryData, jid: any): Promise<boolean>;
  // build(data: QueryData, jid: any): Promise<boolean>;
  // execute(data: QueryData, jid: any): Promise<boolean>;
  // finalize(): Promise<boolean>;
}
