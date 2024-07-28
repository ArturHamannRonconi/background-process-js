import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export interface ConsumerConfig {
  hasDeadQueue: boolean;
  maxReceivedMessages: number;
  continuouslyPolling: boolean;
  timeoutAfterEndingPollingInMilliseconds: number;
}

export enum Events {
  DEAD = "dead",
  CATCH = "catch",
  FINISH = "finish",
  PROCESS = "process",
}

export type ProcessHook<T> = (data: {
  messages: T[];
  scalingId: string;
}) => Promise<void>;

export abstract class Consumer<MessagesType> extends EventEmitter {
  private isStoppedProcess = false;

  constructor(private readonly config: ConsumerConfig) {
    super();
  }

  protected abstract getMessages(): Promise<MessagesType[]>;
  protected abstract deleteMessages(messages: MessagesType[]): Promise<void>;
  protected abstract markAsDeadMessages(
    messages: MessagesType[],
  ): Promise<void>;

  finish(scalingId: string, messages: MessagesType[]) {
    this.emit(`${Events.FINISH}-${scalingId}`, messages);
  }

  dead(scalingId: string, messages: MessagesType[]) {
    this.emit(`${Events.DEAD}-${scalingId}`, messages);
  }

  catch(err: Error) {
    this.emit(Events.CATCH, err);
  }

  process(hook: ProcessHook<MessagesType>) {
    this.on(Events.PROCESS, hook);
  }

  async poll(amount = 1): Promise<void> {
    this.isStoppedProcess = false;

    this.once(Events.CATCH, (error) => {
      this.isStoppedProcess = true;
      console.error(error);
    });

    const scalablePolling = this.scalablePolling.bind(this);
    const pollings = new Array(amount).fill(scalablePolling);

    const pollPromises = pollings.map(async (poll) => {
      const scalingId = randomUUID();
      await poll(scalingId);
    });

    await Promise.all(pollPromises);
  }

  private async scalablePolling(scalingId: string) {
    if (this.isStoppedProcess) return;

    let messages: MessagesType[] = [];
    const isEmpty = (messages: MessagesType[]) => messages.length === 0;

    const deleteMessages = this.deleteMessages.bind(this);
    const markAsDeadMessages = this.markAsDeadMessages.bind(this);
    const scalablePolling = this.scalablePolling.bind(this, scalingId);
    const timeoutToPolling = (messages: MessagesType[]) =>
      setTimeout(
        scalablePolling(messages),
        this.config.timeoutAfterEndingPollingInMilliseconds,
      );

    try {
      if (this.config.continuouslyPolling) {
        do {
          messages = await this.getMessages();
        } while (isEmpty(messages));
      } else {
        messages = await this.getMessages();
        if (isEmpty(messages)) return;
      }

      this.once(`${Events.FINISH}-${scalingId}`, deleteMessages);

      if (this.config.hasDeadQueue) {
        this.once(`${Events.DEAD}-${scalingId}`, markAsDeadMessages);
      }

      const receivedMaxMessages =
        messages.length === this.config.maxReceivedMessages;

      if (receivedMaxMessages) {
        this.once(`${Events.FINISH}-${scalingId}`, scalablePolling);
      } else if (this.config.continuouslyPolling) {
        this.once(`${Events.FINISH}-${scalingId}`, timeoutToPolling);
      }

      this.emit(Events.PROCESS, { messages, scalingId });
    } catch (error) {
      this.catch(error);
    }
  }
}
