import { config } from "./config.js";
import { buildApp } from "./app.js";
import { closeAllConnections } from "./db/client.js";
import { connectRedis, disconnectRedis } from "./lib/redis.js";

const app = buildApp();

try {
  await connectRedis();
  app.log.info("Redis connected");
  await app.listen({ port: config.api.port, host: config.api.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

async function shutdown(): Promise<void> {
  app.log.info("Shutting down...");
  await disconnectRedis();
  await closeAllConnections();
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
