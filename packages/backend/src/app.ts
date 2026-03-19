import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";

/**
 * Build the Fastify application instance.
 * Registers all plugins, middleware, and routes.
 */
export function buildApp(): ReturnType<typeof Fastify> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      ...(config.nodeEnv === "development"
        ? { transport: { target: "pino-pretty" } }
        : {}),
    },
  });

  // ── Plugins ──

  void app.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  // TODO: Phase 2 — Register @fastify/swagger + @scalar/api-reference
  // TODO: Phase 2 — Register @fastify/multipart
  // TODO: Phase 2 — Register @fastify/websocket
  // TODO: Phase 3 — Register Better Auth routes at /api/auth/*

  // ── Routes ──

  // Health check (unauthenticated)
  void app.register(healthRoutes);

  // TODO: Phase 3+ — Register API v1 routes
  // void app.register(async (api) => {
  //   void api.register(entityRoutes, { prefix: "/entities" });
  //   void api.register(jobRoutes, { prefix: "/jobs" });
  //   ...
  // }, { prefix: "/api/v1" });

  return app;
}
