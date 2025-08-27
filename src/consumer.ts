import { EventEmitter } from "node:events";

import { Message, Provider } from "./providers/provider";
import { PollingStrategy } from "./strategies/polling/polling.strategy";
import { RestartStrategy } from "./strategies/restart/restart.strategy";

export type Messages = {
  finished: Message[];
  dead?: Message[];
};

export type FinishFunction = (
  restartStrategy: RestartStrategy,
  messages: Messages,
) => Promise<void>;

export type ProcessHook = (
  messages: Message[],
  finish: FinishFunction,
) => Promise<void>;

export enum Events {
  STOP_REQUEST = "stop-request",
  START_REQUEST = "start-request",
  RECEIVED_MESSAGE = "received-message",
}

export class Consumer {
  private readonly emitter: EventEmitter;
  private pollingStrategy: PollingStrategy;

  constructor(private readonly provider: Provider) {
    this.emitter = new EventEmitter();
  }

  process(pollingStrategy: PollingStrategy, hook: ProcessHook) {
    this.pollingStrategy = pollingStrategy;
    this.emitter.on(Events.RECEIVED_MESSAGE, hook);
    this.emitter.on(Events.START_REQUEST, async () => {
      const incomingAllMessages = await this.pollingStrategy.exec(
        this.provider,
      );

      this.emitter.emit(
        Events.RECEIVED_MESSAGE,
        incomingAllMessages,
        this.finish.bind(this),
      );
    });

    this.emitter.once(Events.STOP_REQUEST, () => {
      this.emitter.removeAllListeners(Events.START_REQUEST);
      this.emitter.removeAllListeners(Events.RECEIVED_MESSAGE);
    });
  }

  stop() {
    this.emitter.emit(Events.STOP_REQUEST);
  }

  start() {
    this.emitter.emit(Events.START_REQUEST);
  }

  private async finish(restartStrategy: RestartStrategy, messages: Messages) {
    if (this.provider.hasDeadQueue() && messages.dead) {
      await this.provider.markAsDeadMessages(messages.dead);
    }

    await this.provider.deleteMessages(messages.finished);
    await restartStrategy.exec(this);
  }
}
