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
    WaitTimeSeconds: 25,
    VisibilityTimeout: 30,
    MaxNumberOfMessages: 10,
    QueueUrl: 'https://sqs.{region}.amazonaws.com/{accountID}/{queueName}'
  };


  const fiveSeconds = 5 * 1000; // (optional) if is undefined is equal 1 minute
  const consumerConfig = { intervalInMilliseconds: fiveSeconds };

  const consumer = new SQSConsumer(sqsConfig, consumerConfig);
```

### Using your own implementation.

```ts
  import { Message } from 'aws-sdk';
  import { Consumer, ConsumerConfig } from "background-process-js";

  export class SQSConsumer extends Consumer<Message> {
    
    constructor() {
      const fiveSeconds = 5 * 1000; // (optional) if is undefined is equal 1 minute
      const consumerConfig = { intervalInMilliseconds: fiveSeconds };

      super(consumerConfig);
    }

    protected async messagesPolling(): Promise<Message[]> {
      // code...
    }

    protected async deleteMessages(messages: Message[]): Promise<void> {
      // code...
    }
  }
```

For any implementation you can set the following listeners and methods.
```ts
  import { Message } from 'aws-sdk';

  // This process event will be execute by default every 1 minute 
  consumer.on('process', (messages: Message[]) => {
    // code for processing message...

    if (isInvalidMessage) {
      // This emitter will be log an error and stop consumer
      consumer.emit('catch', new Error());
    }

    // This emmiter will be delete message from queue
    consumer.emit('finish', messages);
  });

  // This method will start consumer process
  consumer.start();

  // This method will stop consumer process
  consumer.stop();
```