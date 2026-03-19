import { config } from "./config.js";
import { buildApp } from "./app.js";
import { closeAllConnections } from "./db/client.js";

const app = buildApp();

// TODO: Phase 2 — Start BullMQ workers
// const pdfWorker = startPdfWorker();
// const emailWorker = startEmailWorker();

try {
  await app.listen({ port: config.api.port, host: config.api.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

async function shutdown(): Promise<void> {
  app.log.info("Shutting down...");
  // TODO: Close BullMQ workers
  await closeAllConnections();
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
