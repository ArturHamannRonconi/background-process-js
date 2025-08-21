import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export interface ConsumerConfig {
  hasDeadQueue: boolean;
  maxReceivedMessages: number;
  continuouslyPolling: boolean;
  timeoutAfterEndingPollingInMilliseconds: number;
}

export enum Events {
  STOP = "stop",
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
  private stopedProcess = 0;
  private processToStop = 0;
  private needStopProcess = false;
  private stopPromiseResolver: (value: unknown) => void;

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

  async stop() {
    return new Promise((resolve) => {
      this.emit(Events.STOP);
      this.stopPromiseResolver = resolve;
    });
  }

  async catch(err: Error) {
    this.emit(Events.CATCH, err);
    await this.stop();
  }

  process(hook: ProcessHook<MessagesType>) {
    this.on(Events.PROCESS, hook);
  }

  async poll(amount = 1): Promise<void> {
    this.processToStop = amount;
    this.needStopProcess = false;

    this.once(Events.CATCH, console.error);
    this.once(Events.STOP, () => {
      this.needStopProcess = true;
    });

    const scalablePolling = this.scalablePolling.bind(this);
    const scalablePollings = new Array(amount).fill(scalablePolling);

    const pollPromises = scalablePollings.map(async (scalePoll) => {
      const scalingId = randomUUID();
      await scalePoll(scalingId);
    });

    await Promise.all(pollPromises);
  }

  private considerStopedProcess() {
    this.stopedProcess += 1;

    if (this.processToStop === this.stopedProcess) {
      this.stopPromiseResolver(null);
    }
  }

  private async scalablePolling(scalingId: string) {
    if (this.needStopProcess) {
      return this.considerStopedProcess();
    }

    let messages: MessagesType[] = [];

    const deleteMessages = this.deleteMessages.bind(this);
    const markAsDeadMessages = this.markAsDeadMessages.bind(this);
    const scalablePolling = this.scalablePolling.bind(this, scalingId);

    const isEmpty = (arr: Array<any>) => arr.length === 0;
    const timeoutToPolling = (messages: MessagesType[]) =>
      setTimeout(
        () => scalablePolling(messages),
        this.config.timeoutAfterEndingPollingInMilliseconds,
      );

    try {
      if (this.config.continuouslyPolling) {
        do {
          messages = await this.getMessages();
          if (this.needStopProcess) break;
        } while (isEmpty(messages));

        if (this.needStopProcess) {
          return this.considerStopedProcess();
        }
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
