import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/* A throwaway mongod for the test run, so tests read the fixture slice and can
   never write to the shared Atlas cluster. The first run downloads the mongod
   binary (~100 MB, cached afterwards). */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const server = await MongoMemoryServer.create();
  project.provide("mongoUri", server.getUri());
  return async () => {
    await server.stop();
  };
}
