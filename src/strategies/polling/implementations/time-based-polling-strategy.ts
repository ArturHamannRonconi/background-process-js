import { PollingStrategy } from "../polling.strategy";
import { Message, Provider } from "../../../providers/provider";

export class TimeBasedPollingStrategy implements PollingStrategy {
  private messages: Message[] = [];

  constructor(
    private readonly waitIntervalForEachGettedMessagesGroupInMilliseconds: number = 5000,
    private readonly maxNumberOfMessagesTotal: number = 100,
  ) {} // five seconds is recomended

  async exec(provider: Provider): Promise<Message[]> {
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const messages = await provider.getMessages();
        this.messages.push(...messages);

        if (this.messages.length >= this.maxNumberOfMessagesTotal) {
          clearInterval(interval);

          const allMessages = this.messages;
          this.messages = [];

          resolve(allMessages);
        }
      }, this.waitIntervalForEachGettedMessagesGroupInMilliseconds);
    });
  }
}
