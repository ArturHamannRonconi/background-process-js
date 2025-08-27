export type Message = {
  id: string;
  body: string;
  attributes?: Map<string, any>;
};

export interface Provider {
  hasDeadQueue(): boolean;
  getMaxNumberOfMessagesTotal(): number;
  getMaxNumberOfMessagesByRequest(): number;
  getMessages(): Promise<Message[]>;
  deleteMessages(messages: Message[]): Promise<void>;
  markAsDeadMessages(messages: Message[]): Promise<void>;
}
