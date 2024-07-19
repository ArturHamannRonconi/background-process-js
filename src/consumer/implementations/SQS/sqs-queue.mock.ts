import { spawnSync } from "node:child_process";

export function createMock() {
  spawnSync("docker", ["compose", "up", "-d"]);

  spawnSync("aws", [
    "sqs",
    "create-queue",
    "--endpoint-url",
    "http://localhost:4566",
    "--queue-name",
    "teste",
    "--profile",
    "local-test",
  ]);

  spawnSync("aws", [
    "sqs",
    "create-queue",
    "--endpoint-url",
    "http://localhost:4566",
    "--queue-name",
    "dead",
    "--profile",
    "local-test",
  ]);

  return {
    mainQueueUrl: "http://localhost:4566/000000000000/teste",
    deadQueueUrl: "http://localhost:4566/000000000000/dead",
  };
}

export function deleteMock() {
  spawnSync("docker", ["compose", "down"]);
}
