# background-process-js
A set of util tools for create background process.

## How to use?

You have two manners for use background-process-js, you can use some our implementations or you can create your own.

### Using our implementation.

```ts
  import { SQSClient } from 'aws-sdk';
  import { SQSConsumer, SQSConfig, ConsumerConfig } from 'background-process-js';

  const sqs = new SQSClient();
  const sqsConfig = {
    client: sqs,
    WaitTimeSeconds: 20,
    VisibilityTimeout: 30,
    MaxNumberOfMessages: 10,
    mainQueueUrl: 'https://sqs.{region}.amazonaws.com/{accountID}/{queueName}'
    deadQueueUrl: 'https://sqs.{region}.amazonaws.com/{accountID}/{queueName}'
  };


  const fiveSeconds = 5 * 1000; // (optional) if is undefined is equal 1 minute
  const consumerConfig = {
    hasDeadQueue: true,
    intervalInMilliseconds: fiveSeconds,
  };

  const consumer = new SQSConsumer(sqsConfig, consumerConfig);
```

### Using your own implementation.

```ts
  import { Message } from 'aws-sdk';
  import { Consumer, ConsumerConfig } from "background-process-js";

  export class SQSConsumer extends Consumer<Message> {
    
    constructor() {
      const fiveSeconds = 5 * 1000; // (optional) if is undefined is equal 1 minute
      const consumerConfig = {
        hasDeadQueue: true,
        intervalInMilliseconds: fiveSeconds,
      };

      super(consumerConfig);
    }

    protected async messagesPolling(): Promise<Message[]> {
      // code...
    }

    protected async deleteMessages(messages: Message[]): Promise<void> {
      // code...
    }

    protected async markAsDeadMessages(messages: Message[]): Promise<void> {
      // code...
    }
  }
```

For any implementation you can set the following listeners and methods.
```ts
  // This process event will be execute by default every 1 minute 
  consumer.process(({ messages, intervalId }) => {
    // code for processing message...

    const deadMessages = [...messages];
    const processedMessages = [...messages];

    if (isInvalidMessage) {
      // This emitter will be log an error and stop consumer
      consumer.catch(new Error());
    }

    // This emmiter will be delete message from queue
    consumer.finish(intervalId, processedMessages);

    // This emmiter will be send messages to dead queue
    consumer.dead(intervalId, deadMessages);
  });

  // This method will start many intervals of consumers
  consumer.start(5);

  // This method will stop all intervals of consumers
  consumer.stop();
```