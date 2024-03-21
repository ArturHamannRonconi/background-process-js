import { EventEmitter } from "events";

export interface ConsumerConfig {
  intervalInMilliseconds?: number;
}

export abstract class Consumer<MessagesType> extends EventEmitter {
  private interval: NodeJS.Timeout;

  constructor(private readonly config: ConsumerConfig) {
    super();

    const oneMinute = 60 * 1000;
    this.config.intervalInMilliseconds =
      config.intervalInMilliseconds ?? oneMinute;
  }

  protected abstract messagesPolling(): Promise<MessagesType[]>;
  protected abstract deleteMessages(messages: MessagesType[]): Promise<void>;

  start(): void {
    this.once("catch", (error) => {
      this.stop();
      console.error(error);
    });

    this.interval = setInterval(async () => {
      this.once("finish", async () => {
        await this.deleteMessages(messages);
      });

      const messages = await this.messagesPolling();

      if (messages.length <= 0) return;
      this.emit("process", messages);
    }, this.config.intervalInMilliseconds);
  }

  stop() {
    clearInterval(this.interval);
  }
}
