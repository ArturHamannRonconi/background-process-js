import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export interface ConsumerConfig {
  hasDeadQueue: boolean;
  intervalInMilliseconds?: number;
}

export enum Events {
  DEAD = "dead",
  CATCH = "catch",
  FINISH = "finish",
  PROCESS = "process",
}

export abstract class Consumer<MessagesType> extends EventEmitter {
  private intervals: NodeJS.Timeout[];

  constructor(private readonly config: ConsumerConfig) {
    super();

    const oneMinute = 60 * 1000;
    this.config.intervalInMilliseconds =
      config.intervalInMilliseconds ?? oneMinute;
  }

  protected abstract messagesPolling(): Promise<MessagesType[]>;
  protected abstract deleteMessages(messages: MessagesType[]): Promise<void>;
  protected abstract markAsDeadMessages(
    messages: MessagesType[],
  ): Promise<void>;

  finish(intervalId: string, messages: MessagesType[]) {
    this.emit(`${Events.FINISH}-${intervalId}`, messages);
  }

  dead(intervalId: string, messages: MessagesType[]) {
    this.emit(`${Events.DEAD}-${intervalId}`, messages);
  }

  catch(err: Error) {
    this.emit(Events.CATCH, err);
  }

  process(
    callback: (data: {
      messages: MessagesType;
      intervalId: string;
    }) => Promise<void>,
  ) {
    this.on(Events.PROCESS, callback);
  }

  start(amount = 1): void {
    this.intervals = new Array(amount);

    const stop = this.stop.bind(this);
    const deleteMessages = this.deleteMessages.bind(this);
    const markAsDeadMessages = this.markAsDeadMessages.bind(this);

    this.once(Events.CATCH, stop);

    for (let i = 0; i < amount; i++) {
      const intervalId = randomUUID();

      const interval = setInterval(async () => {
        const messages = await this.messagesPolling();
        if (messages.length <= 0) return;

        this.once(`${Events.FINISH}-${intervalId}`, deleteMessages);

        if (this.config.hasDeadQueue) {
          this.once(`${Events.DEAD}-${intervalId}`, markAsDeadMessages);
        }

        this.emit(Events.PROCESS, { messages, intervalId });
      }, this.config.intervalInMilliseconds);

      this.intervals[i] = interval;
    }
  }

  stop(error?: Error) {
    this.intervals.forEach(clearInterval);
    if (error) console.error(error);
  }
}
