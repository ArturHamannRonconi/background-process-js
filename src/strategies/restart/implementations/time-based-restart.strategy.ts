import { sleep } from "../../../utils/sleep";
import { Consumer } from "../../../consumer";
import { RestartStrategy } from "../restart.strategy";

export class TimeBasedRestartStrategy implements RestartStrategy {
  constructor(
    private readonly waitIntervalToNextStartInMilliseconds: number = 20000,
  ) {} // twenty seconds is recommended

  async exec(consumer: Consumer): Promise<void> {
    try {
      await sleep(this.waitIntervalToNextStartInMilliseconds);

      consumer.start();
    } catch (error) {
      consumer.stop();
      throw new Error();
    }
  }
}
