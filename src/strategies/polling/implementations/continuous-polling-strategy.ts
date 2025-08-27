import { sleep } from "../../../utils/sleep";
import { Message, Provider } from "../../../providers/provider";
import { PollingStrategy } from "../polling.strategy";

export class ContinuousPollingStrategy implements PollingStrategy {
  private messages: Message[] = [];

  constructor(
    private readonly waitIntervalIfEmptyQueueInMilliseconds: number = 20000,
  ) {} // twenty seconds is recomended

  async exec(provider: Provider): Promise<Message[]> {
    let messages: Message[] = [];

    do {
      messages = await provider.getMessages();
      this.messages.push(...messages);

      if (messages.length < provider.getMaxNumberOfMessagesByRequest()) {
        await sleep(this.waitIntervalIfEmptyQueueInMilliseconds);
        continue;
      }
    } while (this.messages.length < provider.getMaxNumberOfMessagesTotal());

    const allMessages = this.messages;
    this.messages = [];

    return allMessages;
  }
}
