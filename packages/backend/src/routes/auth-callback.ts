import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { validateToken } from "../lib/opshield-client.js";
import { config } from "../config.js";

/**
 * Auth callback route — receives the JWT from OpShield after login.
 *
 * Flow (from docs/07-AUTH-ARCHITECTURE.md):
 * 1. User visits Nexum, is unauthenticated
 * 2. Frontend redirects to OpShield login
 * 3. User authenticates on OpShield
 * 4. OpShield redirects to /auth/callback?token=<JWT>
 * 5. This route validates the JWT, sets a local session cookie
 * 6. Redirects to the frontend
 */
export async function authCallbackRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.query as { token?: string };

      if (!token) {
        return reply.redirect(
          `${config.frontendUrl}/auth-error?error=missing_token`,
        );
      }

      try {
        // Validate the JWT against OpShield's JWKS
        await validateToken(token);

        // Set local session cookie with the validated token
        // httpOnly, secure (in prod), sameSite strict
        const isProduction = config.nodeEnv === "production";

        void reply.header(
          "Set-Cookie",
          [
            `opshield_token=${token}`,
            "Path=/",
            "HttpOnly",
            `SameSite=${isProduction ? "Strict" : "Lax"}`,
            isProduction ? "Secure" : "",
            `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
          ]
            .filter(Boolean)
            .join("; "),
        );

        return reply.redirect(`${config.frontendUrl}/dashboard`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        request.log.error({ err: errMsg, code: (err as { code?: string }).code }, "Invalid OpShield callback token");
        return reply.redirect(
          `${config.frontendUrl}/auth-error?error=invalid_token`,
        );
      }
    },
  );

  /**
   * POST /auth/logout — clears the local session cookie.
   * Does NOT revoke the OpShield session (that's done via OpShield).
   */
  app.post(
    "/logout",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const isProduction = config.nodeEnv === "production";

      void reply.header(
        "Set-Cookie",
        [
          "opshield_token=",
          "Path=/",
          "HttpOnly",
          `SameSite=${isProduction ? "Strict" : "Lax"}`,
          isProduction ? "Secure" : "",
          "Max-Age=0",
        ]
          .filter(Boolean)
          .join("; "),
      );

      return { success: true };
    },
  );

  /**
   * GET /auth/login-url — returns the OpShield login URL for frontend redirects.
   * The frontend calls this to know where to redirect unauthenticated users.
   */
  app.get(
    "/login-url",
    async (_request: FastifyRequest) => {
      const callbackUrl = `${config.opshield.apiUrl.replace("localhost:3000", `localhost:${config.api.port}`)}/api/v1/auth/callback`;

      return {
        success: true,
        data: {
          loginUrl: `${config.opshield.loginUrl}?product=nexum&callback=${encodeURIComponent(callbackUrl)}`,
          signupUrl: `${config.opshield.loginUrl.replace("/login", "/signup")}?product=nexum&callback=${encodeURIComponent(callbackUrl)}`,
        },
      };
    },
  );
}
