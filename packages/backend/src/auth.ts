import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db/client.js";
import { config } from "./config.js";

export const auth = betterAuth({
  basePath: "/api/auth",
  secret: config.auth.secret,
  baseURL: config.auth.url,
  trustedOrigins: [config.frontendUrl],

  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh after 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  user: {
    additionalFields: {
      tenantId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  plugins: [
    twoFactor({
      issuer: "Nexum",
    }),
  ],
});

export type Auth = typeof auth;
