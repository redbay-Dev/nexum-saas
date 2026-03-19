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
  auth: {
    secret: process.env.BETTER_AUTH_SECRET!,
    url: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
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
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5174",
  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;
