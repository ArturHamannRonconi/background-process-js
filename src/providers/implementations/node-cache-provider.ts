import NodeCache from "node-cache";

import { Message, Provider } from "../provider";

export interface InMemoryQueueIDGenerator {
  enqueueID(queueName: string): string;
  dequeueID(queueName: string): string | undefined;
}

export interface NodeCacheProviderConfig {
  client: NodeCache;
  mainQueueName: string;
  idGenerator: InMemoryQueueIDGenerator;
  deadQueueName?: string;
  MaxNumberOfMessagesByChunk?: number;
}

export class NodeCacheProvider implements Provider {
  private readonly MAX_NUMBER_OF_MESSAGES_BY_CHUNK = 10;

  constructor(private readonly nodeCacheConfig: NodeCacheProviderConfig) {
    this.nodeCacheConfig = {
      ...nodeCacheConfig,
      MaxNumberOfMessagesByChunk:
        this.nodeCacheConfig.MaxNumberOfMessagesByChunk ??
        this.MAX_NUMBER_OF_MESSAGES_BY_CHUNK,
    };

    if (
      this.nodeCacheConfig.MaxNumberOfMessagesByChunk >
      this.MAX_NUMBER_OF_MESSAGES_BY_CHUNK
    ) {
      throw Error("Exceeded the maximum number of messages by request (10)");
    } else if (this.nodeCacheConfig.MaxNumberOfMessagesByChunk < 1) {
      throw Error("The minimum number of messages by request is 1");
    }
  }

  hasDeadQueue(): boolean {
    return !!this.nodeCacheConfig.deadQueueName;
  }

  getMaxNumberOfMessagesByChunk(): number {
    return this.nodeCacheConfig.MaxNumberOfMessagesByChunk;
  }

  async getMessages(): Promise<Message[]> {
    const messages = [];

    for (
      let index = 0;
      index < this.nodeCacheConfig.MaxNumberOfMessagesByChunk;
      index++
    ) {
      const id = this.nodeCacheConfig.idGenerator.dequeueID(
        this.nodeCacheConfig.mainQueueName,
      );

      if (!id) break;

      const body = this.nodeCacheConfig.client.get<string>(id);

      messages.push({ id, body });
    }

    return messages;
  }

  async deleteMessages(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    messages.forEach((message) => {
      this.nodeCacheConfig.client.del(message.id);
    });
  }

  async markAsDeadMessages(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    if (!this.hasDeadQueue()) {
      throw Error("Need to pass 'deadQueueUrl' in Node Cache config");
    }

    for (const message of messages) {
      const id = this.nodeCacheConfig.idGenerator.enqueueID(
        this.nodeCacheConfig.deadQueueName,
      );

      this.nodeCacheConfig.client.set(id, message.body);
    }
  }
}
