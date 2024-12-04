import {
  Message,
  SQSClient,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  DeleteMessageBatchCommand,
  MessageSystemAttributeName,
} from "@aws-sdk/client-sqs";

import { Consumer } from "../../consumer";
import { randomUUID } from "crypto";

export interface SQSConfig {
  client: SQSClient;
  mainQueueUrl: string;
  deadQueueUrl?: string;
  WaitTimeSeconds: number;
  VisibilityTimeout: number;
  MaxNumberOfMessages: number;
  MessageAttributeNames?: string[];
  MessageSystemAttributeNames?: MessageSystemAttributeName[];
}

export class SQSConsumer extends Consumer<Message> {
  constructor(
    private readonly sqsConfig: SQSConfig,
    continuouslyPolling = false,
  ) {
    super({
      continuouslyPolling,
      hasDeadQueue: !!sqsConfig.deadQueueUrl,
      maxReceivedMessages: sqsConfig.MaxNumberOfMessages,
      timeoutAfterEndingPollingInMilliseconds: sqsConfig.WaitTimeSeconds,
    });
  }

  protected async getMessages(): Promise<Message[]> {
    const receiveCommand = new ReceiveMessageCommand({
      QueueUrl: this.sqsConfig.mainQueueUrl,
      WaitTimeSeconds: this.sqsConfig.WaitTimeSeconds,
      VisibilityTimeout: this.sqsConfig.VisibilityTimeout,
      MaxNumberOfMessages: this.sqsConfig.MaxNumberOfMessages,
      MessageAttributeNames: this.sqsConfig.MessageAttributeNames,
      MessageSystemAttributeNames: this.sqsConfig.MessageSystemAttributeNames,
    });

    const { Messages } = await this.sqsConfig.client.send(receiveCommand);

    if (!Messages) return [];

    return Messages;
  }

  protected async deleteMessages(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    const deleteMessageCommand = new DeleteMessageBatchCommand({
      QueueUrl: this.sqsConfig.mainQueueUrl,
      Entries: messages.map((message) => ({
        Id: message.MessageId,
        ReceiptHandle: message.ReceiptHandle,
      })),
    });

    await this.sqsConfig.client.send(deleteMessageCommand);
  }

  protected async markAsDeadMessages(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    if (!this.sqsConfig.deadQueueUrl) {
      throw Error("Need to pass 'deadQueueUrl' in sqs config");
    }

    const isFifoQueue = this.sqsConfig.deadQueueUrl.includes(".fifo");
    const sendMessageBatchCommand = new SendMessageBatchCommand({
      QueueUrl: this.sqsConfig.deadQueueUrl,
      Entries: messages.map((message) => ({
        Id: message.MessageId,
        MessageBody: message.Body,
        MessageDeduplicationId: isFifoQueue ? randomUUID() : undefined,
        MessageGroupId: isFifoQueue ? this.sqsConfig.deadQueueUrl : undefined,
      })),
    });

    await this.sqsConfig.client.send(sendMessageBatchCommand);
  }
}
