/**
 * Export OpenAPI spec from the running Fastify server.
 * Usage: pnpm --filter @nexum/backend openapi:export
 */

import { buildApp } from "../packages/backend/src/app.js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function exportOpenApi(): Promise<void> {
  const app = buildApp();
  await app.ready();

  // TODO: Once @fastify/swagger is registered, export the spec
  // const spec = app.swagger();
  // writeFileSync(
  //   resolve(import.meta.dirname, "..", "openapi.json"),
  //   JSON.stringify(spec, null, 2),
  // );

  // eslint-disable-next-line no-console
  console.warn("OpenAPI export not yet configured — @fastify/swagger registration needed");

  await app.close();
}

void exportOpenApi();
