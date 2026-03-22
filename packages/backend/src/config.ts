import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(import.meta.dirname, "../../..", ".env.development") });

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  api: {
    port: Number(process.env.API_PORT ?? 3002),
    host: process.env.API_HOST ?? "0.0.0.0",
  },
  database: {
    url: process.env.DATABASE_URL!,
    host: process.env.DATABASE_HOST ?? "localhost",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? "devuser",
    password: process.env.DATABASE_PASSWORD ?? "",
    name: process.env.DATABASE_NAME ?? "nexum_dev",
  },
  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? "",
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? "nexum:",
  },
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT!,
    accessKey: process.env.STORAGE_ACCESS_KEY!,
    secretKey: process.env.STORAGE_SECRET_KEY!,
    bucket: process.env.STORAGE_BUCKET ?? "nexum-dev",
    region: process.env.STORAGE_REGION ?? "us-east-1",
  },
  opshield: {
    apiUrl: process.env.OPSHIELD_API_URL ?? "http://localhost:3000",
    authUrl: process.env.OPSHIELD_AUTH_URL ?? "http://localhost:3000/api/auth",
    jwksUrl:
      process.env.OPSHIELD_JWKS_URL ??
      "http://localhost:3000/.well-known/jwks.json",
    loginUrl:
      process.env.OPSHIELD_LOGIN_URL ?? "http://localhost:3000/login",
    webhookSecret: process.env.OPSHIELD_WEBHOOK_SECRET ?? "dev-webhook-secret",
    apiKey: process.env.OPSHIELD_API_KEY ?? "dev-api-key",
    productAudience: process.env.PRODUCT_AUDIENCE ?? "redbay-platform",
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.SMTP_FROM ?? "noreply@nexum.com.au",
  },
  sms: {
    apiKey: process.env.SMS_API_KEY ?? "",
    apiSecret: process.env.SMS_API_SECRET ?? "",
    fromNumber: process.env.SMS_FROM_NUMBER ?? "",
  },
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5171",
  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;
