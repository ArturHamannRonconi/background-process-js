import { Message, Provider } from "../../../providers/provider";
import { PollingStrategy } from "../polling.strategy";

export class OncePollingStrategy implements PollingStrategy {
  async exec(provider: Provider): Promise<Message[]> {
    const messages = await provider.getMessages();
    return messages;
  }
}
