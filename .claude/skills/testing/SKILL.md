---
name: testing
description: Test patterns for Nexum — unit tests (Vitest 4), integration tests (API routes against test DB), and E2E tests (Playwright 1.58). Covers test database setup, seeding, cleanup, and conventions. Triggers when writing tests, setting up test infrastructure, or debugging test failures.
user-invocable: false
---

# Testing — Nexum Patterns

Nexum uses Vitest 4 for unit and integration tests, Playwright 1.58 for E2E tests.

## Principles

1. **Every feature ships with tests** — no exceptions
2. **No mocking the database** — use the test database for integration tests
3. **External services mocked at HTTP boundary** — Xero, Google Maps, AI providers, SMS
4. **Business logic (pricing, permissions, compliance) MUST have tests**
5. **Test file co-located with source** — `pricing-engine.ts` → `pricing-engine.test.ts`

## Test Structure

```
packages/
  backend/
    src/
      routes/jobs/
        create.ts
        create.test.ts          # Integration test for the route
      services/
        pricing-engine.ts
        pricing-engine.test.ts  # Unit test for business logic
  frontend/
    src/
      components/
        JobCard.tsx
        JobCard.test.tsx        # Component test
  shared/
    src/
      schemas/
        job.ts
        job.test.ts             # Schema validation test
      utils/
        abn.ts
        abn.test.ts             # Utility function test
  e2e/                          # Playwright E2E tests
    jobs.spec.ts
    auth.spec.ts
    portal.spec.ts
```

## Unit Tests (Vitest 4)

### What to Unit Test
- Business logic functions (pricing calculations, margin checks, ABN validation)
- Zod schema validation (shared schemas tested once)
- Utility functions and helpers
- State management (Zustand stores)
- Pure functions with clear inputs/outputs

### Pattern
```typescript
import { describe, it, expect } from 'vitest';
import { calculateJobPricing } from './pricing-engine';

describe('calculateJobPricing', () => {
  it('should apply hourly rate for time-based pricing', () => {
    const result = calculateJobPricing({
      method: 'hourly',
      rate: 150,
      hours: 8,
    });
    expect(result.total).toBe(1200);
    expect(result.gst).toBe(120);
  });

  it('should reject negative hours', () => {
    expect(() => calculateJobPricing({
      method: 'hourly',
      rate: 150,
      hours: -1,
    })).toThrow('Hours must be positive');
  });

  it('should enforce minimum margin threshold', () => {
    const result = calculateJobPricing({
      method: 'hourly',
      rate: 50,
      hours: 8,
      costRate: 48,
    });
    expect(result.marginWarning).toBe(true);
  });
});
```

### Zod Schema Tests
```typescript
import { describe, it, expect } from 'vitest';
import { createJobSchema } from './job';

describe('createJobSchema', () => {
  it('should accept valid job data', () => {
    const result = createJobSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'transport',
      description: 'Deliver materials to site',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing customer ID', () => {
    const result = createJobSchema.safeParse({
      type: 'transport',
    });
    expect(result.success).toBe(false);
  });
});
```

## Integration Tests (Vitest 4 + Supertest)

### What to Integration Test
- API route handlers end-to-end (request → validation → handler → database → response)
- Authentication and permission checks
- Multi-tenant isolation (tenant A cannot access tenant B data)
- Error responses (400, 401, 403, 404, 409)

### Test Database Setup
```typescript
// packages/backend/src/test-utils/setup.ts
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Use the shared PostgreSQL on the dev server
// Create a nexum_test database with test tenant schemas

beforeAll(async () => {
  // Run migrations on test database
  // Create test tenant schemas
  // Seed test data
});

afterAll(async () => {
  // Clean up test database connections
});

beforeEach(async () => {
  // Reset data to known state (truncate + reseed)
  // Don't reset between individual tests — too slow
  // Reset between test SUITES
});
```

### Route Test Pattern
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../server';
import { seedTestTenant } from '../../test-utils/seed';

describe('POST /api/v1/jobs', () => {
  let app: FastifyInstance;
  let authCookie: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    authCookie = await loginAsTestUser(app, 'admin@test.com');
  });

  it('should create a job with valid data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      headers: { cookie: authCookie },
      payload: {
        customerId: testData.customerId,
        type: 'transport',
        description: 'Test job',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.type).toBe('transport');
  });

  it('should return 400 for invalid data', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      headers: { cookie: authCookie },
      payload: { /* missing required fields */ },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 403 without permission', async () => {
    const readOnlyCookie = await loginAsTestUser(app, 'readonly@test.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      headers: { cookie: readOnlyCookie },
      payload: { /* valid data */ },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should not access another tenant data', async () => {
    const tenantBCookie = await loginAsTestUser(app, 'admin@tenantb.com');

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/jobs/${testData.tenantAJobId}`,
      headers: { cookie: tenantBCookie },
    });

    expect(response.statusCode).toBe(404); // Not 403 — don't reveal existence
  });
});
```

## E2E Tests (Playwright 1.58)

### What to E2E Test
- Critical user workflows: job creation, docket processing, invoice generation
- Portal workflows: contractor login, document upload, approval
- Authentication flows: login, 2FA, session management
- Scheduling: drag-and-drop allocation
- Permission enforcement: UI elements shown/hidden by role

### Pattern
```typescript
import { test, expect } from '@playwright/test';

test.describe('Job Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new transport job', async ({ page }) => {
    await page.goto('/jobs/new');
    await page.selectOption('[name="customer"]', 'Farrell Transport');
    await page.selectOption('[name="type"]', 'transport');
    await page.fill('[name="description"]', 'Deliver sand to site');
    await page.click('button:has-text("Create Job")');

    // Verify redirect to job detail
    await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+/);
    await expect(page.locator('h1')).toContainText('Deliver sand to site');
  });
});
```

### E2E Configuration
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

## Seed Data

### Two Test Tenants

**Tenant A ("Farrell Transport")** — Full-featured, all modules enabled:
- 3 customers (one with rate card, one credit hold, one standard)
- 2 contractors (one fully onboarded, one mid-onboarding)
- 5 drivers (one expiring licence, one non-compliant, three compliant)
- 8 assets (mix of trucks/trailers/equipment, one overdue service, one open defect)
- Jobs in every lifecycle state
- Invoices and RCTIs at various states
- Users with different roles (owner, admin, dispatcher, finance, read-only)

**Tenant B ("Smith Haulage")** — Minimal, core modules only:
- 1 customer, 2 drivers, 3 assets
- 3 jobs (completed, in progress, draft)
- No invoicing data

### Seed Commands
```bash
pnpm db:seed          # Full seed for development
pnpm db:seed:test     # Minimal seed for test suite (faster)
```

## Mocking External Services

```typescript
// Mock at the HTTP boundary, not at the service layer
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const handlers = [
  // Xero API
  http.post('https://api.xero.com/api.xro/2.0/Invoices', () => {
    return HttpResponse.json({ Invoices: [{ InvoiceID: 'mock-id' }] });
  }),

  // Google Maps
  http.get('https://maps.googleapis.com/maps/api/geocode/json', () => {
    return HttpResponse.json({ results: [{ /* mock geocode result */ }] });
  }),

  // AI Provider
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({ content: [{ text: 'Mock AI response' }] });
  }),
];

const mockServer = setupServer(...handlers);

beforeAll(() => mockServer.listen());
afterAll(() => mockServer.close());
afterEach(() => mockServer.resetHandlers());
```

## Test Commands

```bash
pnpm test              # All tests (unit + integration)
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:e2e          # E2E tests (Playwright)
pnpm test -- --watch   # Watch mode
pnpm test -- pricing   # Run tests matching "pricing"
```

## Checklist for Every New Feature

- [ ] Unit tests for business logic (pure functions, calculations, validations)
- [ ] Integration tests for API routes (happy path + error path minimum)
- [ ] Money/pricing calculations have tests
- [ ] Permission checks have tests
- [ ] Tenant isolation verified (tenant A can't see tenant B)
- [ ] External services mocked at HTTP boundary
- [ ] Test file co-located with source
- [ ] Descriptive test names: `it('should reject invoice when margin is below threshold')`
