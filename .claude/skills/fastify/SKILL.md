---
name: fastify
description: Fastify route patterns for Nexum — route registration, plugin structure, hook lifecycle, schema validation with Zod 4, error handling, and authentication/permission middleware. Triggers when working with API routes, middleware, plugins, or server configuration.
user-invocable: false
---

# Fastify — Nexum Patterns

Nexum uses Fastify 5 with `fastify-type-provider-zod` v6 for type-safe route schemas using Zod 4.

## Server Setup

```typescript
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

const app = Fastify().withTypeProvider<ZodTypeProvider>();

// Set Zod as the validation and serialization compiler
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

## Plugin Structure

```
packages/backend/src/
  server.ts              # Fastify instance creation and plugin registration
  plugins/
    auth.ts              # Better Auth integration
    tenant.ts            # Tenant scoping middleware
    permission.ts        # Permission check middleware
    audit.ts             # Audit logging middleware
    websocket.ts         # @fastify/websocket setup
    cors.ts              # @fastify/cors configuration
    swagger.ts           # @fastify/swagger + @scalar/api-reference
    rate-limit.ts        # Redis-backed rate limiting
  routes/
    auth/                # /api/v1/auth/*
    jobs/                # /api/v1/jobs/*
    scheduling/          # /api/v1/scheduling/*
    dockets/             # /api/v1/dockets/*
    pricing/             # /api/v1/pricing/*
    invoicing/           # /api/v1/invoicing/*
    entities/            # /api/v1/entities/*
    documents/           # /api/v1/documents/*
    reports/             # /api/v1/reports/*
    ai/                  # /api/v1/ai/*
    portal/              # /api/v1/portal/*
    driver/              # /api/v1/driver/*
    admin/               # /api/v1/admin/*
    xero/                # /api/v1/xero/*
    notifications/       # /api/v1/notifications/*
    webhooks/            # /api/v1/webhooks/*
```

## Route Registration

### Plugin Pattern
Every route group is a Fastify plugin:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

const jobRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Routes registered here inherit the /api/v1/jobs prefix
  typedApp.get('/', { /* list jobs */ });
  typedApp.post('/', { /* create job */ });
  typedApp.get('/:id', { /* get job */ });
  typedApp.patch('/:id', { /* update job */ });
  typedApp.delete('/:id', { /* soft delete job */ });
};

export default jobRoutes;
```

### Route with Full Schema
```typescript
import { z } from 'zod';
import { createJobSchema, jobResponseSchema } from '@shared/schemas/jobs';

typedApp.post('/', {
  schema: {
    body: createJobSchema,
    response: {
      201: jobResponseSchema,
      400: errorResponseSchema,
      403: errorResponseSchema,
    },
  },
  preHandler: [
    app.authenticate,       // Verify session
    app.requirePermission('jobs.create'),  // Check permission
  ],
}, async (request, reply) => {
  // request.body is fully typed from createJobSchema
  const job = await createJob(request.tenantDb, request.body);

  // Audit log
  await request.audit('job', job.id, 'create', null, job);

  return reply.status(201).send(job);
});
```

## Hook Lifecycle

Fastify hooks execute in this order for each request:

1. `onRequest` — Runs first. Use for: CORS, rate limiting
2. `preParsing` — Before body parsing. Use for: raw body access
3. `preValidation` — Before schema validation. Use for: authentication, tenant scoping
4. `preHandler` — After validation, before handler. Use for: permission checks, business rule checks
5. `preSerialization` — Before response serialization
6. `onSend` — Before sending response. Use for: response headers
7. `onResponse` — After response sent. Use for: logging, metrics

### Where Nexum Middleware Runs

| Middleware | Hook | Purpose |
|-----------|------|---------|
| CORS | `onRequest` | Allow configured origins |
| Rate limiting | `onRequest` | Redis-backed per IP/key/tenant |
| Authentication | `preValidation` | Verify session cookie or API key |
| Tenant scoping | `preValidation` | Set tenant DB from session |
| Permission check | `preHandler` | Verify user has required permission |
| Audit logging | Built into handlers | After successful write operations |

## Error Handling

### Consistent Error Format
```typescript
// Every error response follows this shape
const errorResponseSchema = z.object({
  error: z.string(),       // Human-readable message
  code: z.string(),        // Machine-readable code (e.g., 'VALIDATION_ERROR')
  details: z.unknown().optional(), // Field-level errors for validation
});
```

### Error Handler
```typescript
app.setErrorHandler((error, request, reply) => {
  // Zod validation errors → 400
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.validation,
    });
  }

  // Authentication errors → 401
  // Permission errors → 403
  // Not found → 404 (never reveal if entity exists in another tenant)
  // Conflict → 409 (concurrent modification)
  // Everything else → 500 (log stack trace, return generic message)
});
```

## Authentication Middleware

### Session-Based (Web App)
```typescript
// Better Auth cookie-based sessions
// Middleware extracts session from cookie, validates against PostgreSQL
// Sets request.user and request.tenantId
app.decorateRequest('user', null);
app.decorateRequest('tenantId', null);
app.decorateRequest('tenantDb', null);
```

### API Key (Integrations, DriverX)
```typescript
// Bearer token in Authorization header
// Hashed lookup in database
// Scoped permissions per key
```

## Permission Middleware

```typescript
// DENY BY DEFAULT — every route must declare its permission
// Routes without permission checks will fail CI (doc 22, Permission Audit stage)

function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const hasPermission = await checkPermission(
      request.tenantDb,
      request.user.id,
      permission,
    );
    if (!hasPermission) {
      return reply.status(403).send({
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        details: { required: permission },
      });
    }
  };
}
```

## API Documentation

```typescript
// @fastify/swagger generates OpenAPI spec from Zod schemas
// @scalar/api-reference serves interactive docs at /api/docs
import scalar from '@scalar/fastify-api-reference';

await app.register(scalar, {
  routePrefix: '/api/docs',
  configuration: {
    spec: { url: '/api/docs/openapi.json' },
    theme: 'default',
  },
});
```

## WebSocket

```typescript
import websocket from '@fastify/websocket';

await app.register(websocket);

// WebSocket routes authenticate via session cookie (web) or Bearer token (DriverX)
app.get('/ws', { websocket: true }, (socket, request) => {
  // Authenticate
  // Subscribe to channels based on tenant and user
  // Send/receive JSON messages
});
```

## Checklist for Every New Route

- [ ] Zod schema for request body/params/query (in `@shared/`)
- [ ] Zod schema for response (in `@shared/`)
- [ ] `app.authenticate` in preHandler
- [ ] `app.requirePermission('scope.action')` in preHandler
- [ ] Tenant-scoped database access via `request.tenantDb`
- [ ] Audit log entry for write operations
- [ ] Consistent error response format
- [ ] Integration test (happy path + error path)
- [ ] Explicit TypeScript return types
