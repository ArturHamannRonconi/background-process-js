import {
  SQSClient,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  DeleteMessageBatchCommand,
  MessageSystemAttributeName,
} from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";

import { Message, Provider } from "../provider";
import { splitArrayInChunks } from "../../utils/split-array-in-chunks";

export interface SQSProviderConfig {
  client: SQSClient;
  mainQueueUrl: string;
  MaxNumberOfMessagesTotal: number;
  MaxNumberOfMessagesByRequest?: number;
  deadQueueUrl?: string;
  WaitTimeSeconds?: number;
  VisibilityTimeout?: number;
  MessageAttributeNames?: string[];
  MessageSystemAttributeNames?: MessageSystemAttributeName[];
}

export class SQSProvider implements Provider {
  private readonly sqsConfig: SQSProviderConfig;

  private readonly MAX_VISIBILITY_TIMEOUT = 300;
  private readonly MAX_WAITING_TIME_SECONDS = 20;
  private readonly MAX_NUMBER_OF_MESSAGES_BY_SQS_REQUEST = 10;

  constructor(sqsConfig: SQSProviderConfig) {
    this.sqsConfig = {
      client: sqsConfig.client,
      mainQueueUrl: sqsConfig.mainQueueUrl,
      deadQueueUrl: sqsConfig.mainQueueUrl,
      MessageAttributeNames: sqsConfig.MessageAttributeNames,
      MessageSystemAttributeNames: sqsConfig.MessageSystemAttributeNames,
      MaxNumberOfMessagesTotal: sqsConfig.MaxNumberOfMessagesTotal,
      WaitTimeSeconds:
        sqsConfig.WaitTimeSeconds ?? this.MAX_WAITING_TIME_SECONDS,
      VisibilityTimeout:
        sqsConfig.VisibilityTimeout ?? this.MAX_VISIBILITY_TIMEOUT,
      MaxNumberOfMessagesByRequest:
        sqsConfig.MaxNumberOfMessagesByRequest ??
        this.MAX_NUMBER_OF_MESSAGES_BY_SQS_REQUEST,
    };

    if (
      this.sqsConfig.MaxNumberOfMessagesByRequest >
      this.MAX_NUMBER_OF_MESSAGES_BY_SQS_REQUEST
    ) {
      throw Error("Exceeded the maximum number of messages by request (10)");
    } else if (this.sqsConfig.MaxNumberOfMessagesByRequest < 1) {
      throw Error("The minimum number of messages by request is 1");
    } else if (
      this.sqsConfig.MaxNumberOfMessagesTotal <
      this.sqsConfig.MaxNumberOfMessagesByRequest
    ) {
      throw Error(
        "The total number of messages must be greater than or equal to the number of messages per request",
      );
    }
  }

  hasDeadQueue(): boolean {
    return !!this.sqsConfig.deadQueueUrl;
  }

  getMaxNumberOfMessagesTotal(): number {
    return this.sqsConfig.MaxNumberOfMessagesByRequest >
      this.sqsConfig.MaxNumberOfMessagesTotal
      ? this.sqsConfig.MaxNumberOfMessagesByRequest
      : this.sqsConfig.MaxNumberOfMessagesTotal;
  }

  getMaxNumberOfMessagesByRequest(): number {
    return this.sqsConfig.MaxNumberOfMessagesByRequest;
  }

  async getMessages(): Promise<Message[]> {
    const receiveCommand = new ReceiveMessageCommand({
      QueueUrl: this.sqsConfig.mainQueueUrl,
      WaitTimeSeconds: this.sqsConfig.WaitTimeSeconds,
      VisibilityTimeout: this.sqsConfig.VisibilityTimeout,
      MessageAttributeNames: this.sqsConfig.MessageAttributeNames,
      MaxNumberOfMessages: this.sqsConfig.MaxNumberOfMessagesByRequest,
      MessageSystemAttributeNames: this.sqsConfig.MessageSystemAttributeNames,
    });

    const { Messages } = await this.sqsConfig.client.send(receiveCommand);

    if (!Messages) return [];

    return Messages.map((message) => {
      const attributes = new Map<string, any>();
      attributes.set("MD5OfBody", message.MD5OfBody);
      attributes.set("Attributes", message.Attributes);
      attributes.set("ReceiptHandle", message.ReceiptHandle);
      attributes.set("MessageAttributes", message.MessageAttributes);
      attributes.set("MD5OfMessageAttributes", message.MD5OfMessageAttributes);

      return {
        attributes,
        body: message.Body,
        id: message.MessageId,
      };
    });
  }

  async deleteMessages(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    const chunks = splitArrayInChunks(
      messages,
      this.MAX_NUMBER_OF_MESSAGES_BY_SQS_REQUEST,
    );

    const chunksOfChunks = splitArrayInChunks(chunks, 5);

    for await (const chunk of chunksOfChunks) {
      const promises = chunk.map(async (messagesChunk) => {
        const deleteMessageCommand = new DeleteMessageBatchCommand({
          QueueUrl: this.sqsConfig.mainQueueUrl,
          Entries: messagesChunk.map((message) => ({
            Id: message.id,
            ReceiptHandle: message.attributes.get("ReceiptHandle"),
          })),
        });

        await this.sqsConfig.client.send(deleteMessageCommand);
      });

      await Promise.all(promises);
    }
  }

  async markAsDeadMessages(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    if (!this.sqsConfig.deadQueueUrl) {
      throw Error("Need to pass 'deadQueueUrl' in sqs config");
    }

    const chunks = splitArrayInChunks(
      messages,
      this.MAX_NUMBER_OF_MESSAGES_BY_SQS_REQUEST,
    );

    const chunksOfChunks = splitArrayInChunks(chunks, 5);

    for await (const chunk of chunksOfChunks) {
      const promises = chunk.map(async (messagesChunk) => {
        const isFifoQueue = this.sqsConfig.deadQueueUrl.includes(".fifo");
        const sendMessageBatchCommand = new SendMessageBatchCommand({
          QueueUrl: this.sqsConfig.deadQueueUrl,
          Entries: messagesChunk.map((message) => ({
            Id: message.id,
            MessageBody: message.body,
            MessageDeduplicationId: isFifoQueue ? randomUUID() : undefined,
            MessageGroupId: isFifoQueue
              ? this.sqsConfig.deadQueueUrl
              : undefined,
          })),
        });

        await this.sqsConfig.client.send(sendMessageBatchCommand);
      });

      await Promise.all(promises);
    }
  }
}
