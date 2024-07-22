import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export interface ConsumerConfig {
  hasDeadQueue: boolean;
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

  protected abstract messagesPolling(): Promise<MessagesType[]>;
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

  async start(amount = 1): Promise<void> {
    this.isStoppedProcess = false;

    this.once(Events.CATCH, (error) => {
      this.isStoppedProcess = true;
      console.error(error);
    });

    const startScalingAmount = this.startScalingAmount.bind(this);

    await Promise.all(
      new Array(amount).fill(startScalingAmount).map(async (fn) => {
        const scalingId = randomUUID();
        await fn(scalingId);
      }),
    );
  }

  private async startScalingAmount(scalingId: string) {
    if (this.isStoppedProcess) return;

    try {
      const deleteMessages = this.deleteMessages.bind(this);
      const markAsDeadMessages = this.markAsDeadMessages.bind(this);
      const startScalingAmount = this.startScalingAmount.bind(this, scalingId);

      let messages: MessagesType[] = [];
      const isEmpty = (messages: MessagesType[]) => messages.length <= 0;

      do {
        messages = await this.messagesPolling();
      } while (isEmpty(messages));

      this.once(`${Events.FINISH}-${scalingId}`, deleteMessages);

      if (this.config.hasDeadQueue) {
        this.once(`${Events.DEAD}-${scalingId}`, markAsDeadMessages);
      }

      this.once(`${Events.FINISH}-${scalingId}`, startScalingAmount);

      this.emit(Events.PROCESS, { messages, scalingId });
    } catch (error) {
      this.catch(error);
    }
  }
}
