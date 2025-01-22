import {
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { SQSConfig, SQSConsumer } from "./sqs-consumer";
import { createMock, deleteMock } from "./sqs-queue.mock";
import { Events } from "src/consumer/consumer";

describe("sqs.consumer.spec", () => {
  let client: SQSClient;
  let mainQueueUrl: string;
  let deadQueueUrl: string;
  let sqsConfig: SQSConfig;
  let consumer: SQSConsumer;

  beforeAll(() => {
    const mockQueues = createMock();
    mainQueueUrl = mockQueues.mainQueueUrl;
    deadQueueUrl = mockQueues.deadQueueUrl;

    client = new SQSClient({
      region: "us-east-1",
      endpoint: "http://localhost.localstack.cloud:4566", //{ url: new URL("http://localhost:4566") },
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });

    sqsConfig = {
      client,
      mainQueueUrl,
      deadQueueUrl,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 0,
      MaxNumberOfMessages: 10,
    };

    consumer = new SQSConsumer(sqsConfig);
  });

  beforeEach(async () => {
    await client.send(
      new SendMessageCommand({
        MessageBody: "test",
        QueueUrl: mainQueueUrl,
      }),
    );
  });

  describe("getMessages", () => {
    it("should poll all messages", async () => {
      const clientSendSpy = jest.spyOn(client, "send");

      const getMessages = consumer["getMessages"].bind(consumer);

      const messages = await getMessages();

      expect(clientSendSpy).toHaveBeenCalled();
      expect(messages[0].Body).toEqual("test");
    });
  });

  describe("deleteMessages", () => {
    it("should delete all messages", async () => {
      const getMessages = consumer["getMessages"].bind(consumer);

      const messages1 = await getMessages();
      expect(messages1).toHaveLength(2);

      const clientSendSpy = jest.spyOn(client, "send");
      const deleteMessages = consumer["deleteMessages"].bind(consumer);

      await deleteMessages(messages1);

      expect(clientSendSpy).toHaveBeenCalled();

      const messages2 = await getMessages();
      expect(messages2).toHaveLength(0);
    });
  });

  describe("markAsDeadMessages", () => {
    it("should send message to dead queue", async () => {
      const getMessages = consumer["getMessages"].bind(consumer);

      const messagesFromMain1 = await getMessages();
      expect(messagesFromMain1).toHaveLength(1);

      const { Messages: messagesFromDead1 } = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: sqsConfig.deadQueueUrl,
          WaitTimeSeconds: sqsConfig.WaitTimeSeconds,
          VisibilityTimeout: sqsConfig.VisibilityTimeout,
          MaxNumberOfMessages: sqsConfig.MaxNumberOfMessages,
        }),
      );

      expect(messagesFromDead1).toBeUndefined();

      const clientSendSpy = jest.spyOn(client, "send");
      const markAsDeadMessages = consumer["markAsDeadMessages"].bind(consumer);
      await markAsDeadMessages(messagesFromMain1);

      expect(clientSendSpy).toHaveBeenCalled();

      const { Messages: messagesFromDead2 } = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: sqsConfig.deadQueueUrl,
          WaitTimeSeconds: sqsConfig.WaitTimeSeconds,
          VisibilityTimeout: sqsConfig.VisibilityTimeout,
          MaxNumberOfMessages: sqsConfig.MaxNumberOfMessages,
        }),
      );

      expect(messagesFromDead2).toHaveLength(1);

      const messagesFromMain2 = await getMessages();
      expect(messagesFromMain2).toHaveLength(1);
    });
  });

  describe("consumer.spec", () => {
    describe("start", () => {
      it("should create three intervals", () => {
        consumer.poll(3);

        expect(consumer.eventNames()).toHaveLength(2);

        consumer.catch(new Error());
      });
    });

    describe("finish", () => {
      it("should emit finish event", () => {
        const messages = [];
        const scalingId = "test";

        const emitSpy = jest.spyOn(consumer, "emit");

        consumer.finish(scalingId, messages);

        expect(emitSpy).toHaveBeenCalledWith(
          `${Events.FINISH}-${scalingId}`,
          messages,
        );
      });
    });

    describe("dead", () => {
      it("should emit dead event", () => {
        const messages = [];
        const scalingId = "test";

        const emitSpy = jest.spyOn(consumer, "emit");

        consumer.dead(scalingId, messages);

        expect(emitSpy).toHaveBeenCalledWith(
          `${Events.DEAD}-${scalingId}`,
          messages,
        );
      });
    });

    describe("catch", () => {
      it("should emit catch event", () => {
        const error = new Error("kkk");
        const emitSpy = jest.spyOn(consumer, "emit");

        consumer.catch(error);

        expect(emitSpy).toHaveBeenCalledWith(Events.CATCH, error);
      });
    });

    describe("process", () => {
      it("should listen process event", () => {
        const onSpy = jest.spyOn(consumer, "on");
        const callback = async () => console.log("teste");

        consumer.process(callback);

        expect(onSpy).toHaveBeenCalledWith(Events.PROCESS, callback);

        consumer.removeListener(Events.PROCESS, callback);
      });
    });
  });

  afterAll(() => deleteMock());
});
