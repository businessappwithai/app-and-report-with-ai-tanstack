import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import { codeAgent } from "./agents/code-agent";

export const mastra = new Mastra({
  agents: { codeAgent },
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: process.env.MASTRA_DATABASE_URL ?? "file:../../../../mastra.db",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: (process.env.MASTRA_LOG_LEVEL ??
      (process.env.NODE_ENV === "production" ? "info" : "debug")) as
      | "debug"
      | "info"
      | "warn"
      | "error",
  }),
  server: {
    port: Number(process.env.MASTRA_PORT ?? 4111),
    host: process.env.MASTRA_HOST ?? "localhost",
  },
});

export { codeAgent };
