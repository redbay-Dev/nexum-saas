import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authMeRoutes } from "./routes/auth-me.js";
import { authCallbackRoutes } from "./routes/auth-callback.js";
import { companyRoutes } from "./routes/companies.js";
import { webhookRoutes } from "./routes/webhooks.js";

/**
 * Build the Fastify application instance.
 * Registers all plugins, middleware, and routes.
 *
 * Auth is delegated to OpShield — Nexum validates JWTs via JWKS
 * and manages its own local session cookies.
 */
export function buildApp(): ReturnType<typeof Fastify> {
  const isDev = config.nodeEnv === "development";

  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: isDev
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    },
    disableRequestLogging: isDev,
  });

  // Dev: single-line request log for errors only
  if (isDev) {
    app.addHook("onResponse", (request, reply, done) => {
      const status = reply.statusCode;
      if (status >= 400) {
        app.log.warn(
          `${request.method} ${request.url} → ${status} (${reply.elapsedTime.toFixed(0)}ms)`,
        );
      }
      done();
    });
  }

  // ── Plugins ──

  void app.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  // TODO: Phase 2 — Register @fastify/swagger + @scalar/api-reference
  // TODO: Phase 2 — Register @fastify/multipart
  // TODO: Phase 2 — Register @fastify/websocket

  // ── Routes ──

  // Health check (unauthenticated)
  void app.register(healthRoutes);

  // OpShield webhooks (authenticated via HMAC signature, not JWT)
  void app.register(webhookRoutes, { prefix: "/api/webhooks" });

  // API v1 routes
  void app.register(
    async (api) => {
      api.get("/status", async () => ({
        success: true,
        data: { version: "0.0.0", environment: config.nodeEnv },
      }));

      // Auth routes (callback from OpShield, logout, login URL)
      void api.register(authCallbackRoutes, { prefix: "/auth" });

      // Auth identity (tenant-scoped)
      void api.register(authMeRoutes, { prefix: "/auth" });

      // Business routes (tenant-scoped)
      void api.register(companyRoutes, { prefix: "/companies" });
    },
    { prefix: "/api/v1" },
  );

  return app;
}
