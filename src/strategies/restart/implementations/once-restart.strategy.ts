import { Consumer } from "../../../consumer";
import { RestartStrategy } from "../restart.strategy";

export class OnceRestartStrategy implements RestartStrategy {
  async exec(consumer: Consumer): Promise<void> {
    return consumer.stop();
  }
}
