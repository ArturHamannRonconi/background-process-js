export type Message = {
  id: string;
  body: string;
  attributes?: Map<string, any>;
};

export interface Provider {
  hasDeadQueue(): boolean;
  getMessages(): Promise<Message[]>;
  getMaxNumberOfMessagesByChunk(): number;
  deleteMessages(messages: Message[]): Promise<void>;
  markAsDeadMessages(messages: Message[]): Promise<void>;
}
