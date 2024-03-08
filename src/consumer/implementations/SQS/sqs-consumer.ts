import {
  Message,
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageBatchCommand,
} from "@aws-sdk/client-sqs";

import { Consumer, ConsumerConfig } from "../../consumer";

export interface SQSConfig {
  QueueUrl: string;
  client: SQSClient;
  WaitTimeSeconds: number;
  VisibilityTimeout: number;
  MaxNumberOfMessages: number;
}

export class SQSConsumer extends Consumer<Message> {
  constructor(
    private readonly sqsConfig: SQSConfig,
    consumerConfig: ConsumerConfig,
  ) {
    super(consumerConfig);
  }

  protected async messagesPolling(): Promise<Message[]> {
    const receiveCommand = new ReceiveMessageCommand({
      QueueUrl: this.sqsConfig.QueueUrl,
      WaitTimeSeconds: this.sqsConfig.WaitTimeSeconds,
      VisibilityTimeout: this.sqsConfig.VisibilityTimeout,
      MaxNumberOfMessages: this.sqsConfig.MaxNumberOfMessages,
    });

    const { Messages } = await this.sqsConfig.client.send(receiveCommand);

    if (!Messages) return [];

    return Messages;
  }

  protected async deleteMessages(messages: Message[]): Promise<void> {
    const deleteMessageCommand = new DeleteMessageBatchCommand({
      QueueUrl: this.sqsConfig.QueueUrl,
      Entries: messages.map((message) => ({
        Id: message.MessageId,
        ReceiptHandle: message.ReceiptHandle,
      })),
    });

    await this.sqsConfig.client.send(deleteMessageCommand);
  }
}
