import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { auth } from "./auth.js";
import { healthRoutes } from "./routes/health.js";
import { authMeRoutes } from "./routes/auth-me.js";
import { onboardRoutes } from "./routes/onboard.js";
import { companyRoutes } from "./routes/companies.js";

/**
 * Build the Fastify application instance.
 * Registers all plugins, middleware, and routes.
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

  // Better Auth — handle all /api/auth/* routes
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `${request.protocol}://${request.hostname}`,
      );

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) {
          headers.append(key, Array.isArray(value) ? value.join(", ") : value);
        }
      }

      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body:
          request.method !== "GET" && request.body
            ? JSON.stringify(request.body)
            : undefined,
      });

      const response = await auth.handler(req);

      void reply.status(response.status);
      response.headers.forEach((value, key) => {
        void reply.header(key, value);
      });

      const rawBody = await response.text();
      if (rawBody) {
        try {
          return JSON.parse(rawBody) as unknown;
        } catch {
          return null;
        }
      }
      return null;
    },
  });

  // API v1 routes (tenant-scoped)
  void app.register(
    async (api) => {
      api.get("/status", async () => ({
        success: true,
        data: { version: "0.0.0", environment: config.nodeEnv },
      }));

      void api.register(authMeRoutes, { prefix: "/auth" });
      void api.register(onboardRoutes, { prefix: "/onboard" });
      void api.register(companyRoutes, { prefix: "/companies" });
    },
    { prefix: "/api/v1" },
  );

  return app;
}
