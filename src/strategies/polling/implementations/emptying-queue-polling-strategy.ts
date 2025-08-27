import { PollingStrategy } from "../polling.strategy";
import { Message, Provider } from "../../../providers/provider";

export class EmptyingQueuePollingStrategy implements PollingStrategy {
  private messages: Message[] = [];

  async exec(provider: Provider): Promise<Message[]> {
    let messages: Message[] = [];

    do {
      messages = await provider.getMessages();
      this.messages.push(...messages);
    } while (messages.length === provider.getMaxNumberOfMessagesByChunk());

    const allMessages = this.messages;
    this.messages = [];

    return allMessages;
  }
}
