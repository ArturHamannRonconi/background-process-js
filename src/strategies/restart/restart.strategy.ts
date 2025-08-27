import { Consumer } from "../../consumer";

export interface RestartStrategy {
  exec(consumer: Consumer): Promise<void>;
}
