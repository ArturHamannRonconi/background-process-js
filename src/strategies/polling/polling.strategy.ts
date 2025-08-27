import { Message, Provider } from "../../providers/provider";

export interface PollingStrategy {
  exec(provider: Provider): Promise<Message[]>;
}
