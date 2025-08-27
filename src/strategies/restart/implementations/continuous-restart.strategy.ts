import { Consumer } from "../../../consumer";
import { RestartStrategy } from "../restart.strategy";

export class ContinuousRestartStrategy implements RestartStrategy {
  async exec(consumer: Consumer): Promise<void> {
    try {
      consumer.start();
    } catch (error) {
      consumer.stop();
      throw new Error();
    }
  }
}
