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


  // If it is true will continuously polling in the queue,
  // and if the queue return less than MaxNumberOfMessages and greather than zero
  // will set a timeout with WaitTimeSeconds number for continuously polling queue.  
  
  // If it is false you must control the timeouts and times for polling.
  const continuouslyPolling = true || false;
                                              // Default false
  const consumer = new SQSConsumer(sqsConfig, continuouslyPolling);
```

### Using your own implementation.

```ts
  import { Message } from 'aws-sdk';
  import { Consumer } from "background-process-js";

  export class SQSConsumer extends Consumer<Message> {
    
    constructor() {
      super({
        hasDeadQueue: true || false,
        maxReceivedMessages: 10,
        continuouslyPolling: true || false,
        timeoutAfterEndingPollingInMilliseconds: 20 * 1000, // 20 seconds
      });
    }

    protected async getMessages(): Promise<Message[]> {
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
  consumer.process(({ messages, scalingId }) => {
    // code for processing message...

    const deadMessages = [...messages];
    const processedMessages = [...messages];

    if (isInvalidMessage) {
      // This emitter will be log an error and stop consumer
      consumer.catch(new Error());
    }

    // This emmiter will be delete message from queue
    consumer.finish(scalingId, processedMessages);

    // This emmiter will be send messages to dead queue
    consumer.dead(scalingId, deadMessages);
  });

  // This method will start many pollings
  consumer.poll(5);
```