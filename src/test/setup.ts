import { afterAll, inject } from "vitest";
import { closeMongo } from "@/lib/db/client";

// Point lib/db at the throwaway mongod; whatever MONGODB_URI the shell had is ignored.
process.env.MONGODB_URI = inject("mongoUri");

afterAll(async () => {
  await closeMongo();
});
