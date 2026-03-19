import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, tenantUsers } from "../db/schema/public.js";
import { getSession } from "../middleware/auth.js";
import { provisionTenantSchema } from "../db/provision-tenant.js";
import { createTenantSchema } from "@nexum/shared";
import type { CreateTenantInput } from "@nexum/shared";
import postgres from "postgres";
import { config } from "../config.js";

/**
 * Onboarding routes — creates a new tenant for an authenticated user.
 *
 * Flow:
 * 1. User signs up via Better Auth (POST /api/auth/sign-up/email)
 * 2. User calls POST /api/v1/onboard with their company details
 * 3. We create the tenant, provision the schema, seed the organisation, and link the user
 */
export async function onboardRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/onboard
   * Creates a new tenant for the authenticated user.
   * Requires: authenticated session (cookie from Better Auth sign-up/sign-in)
   */
  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    // Verify user is authenticated
    const session = await getSession(request);
    if (!session) {
      return reply.status(401).send({
        error: "Authentication required. Sign up or sign in first.",
        code: "UNAUTHENTICATED",
      });
    }

    // Check if user already has a tenant
    const [existingMembership] = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.userId, session.user.id))
      .limit(1);

    if (existingMembership) {
      return reply.status(409).send({
        error: "You already belong to a tenant",
        code: "TENANT_EXISTS",
      });
    }

    // Validate request body
    const parsed = createTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid onboarding data",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const input: CreateTenantInput = parsed.data;
    const tenantId = crypto.randomUUID();
    const schemaName = `tenant_${tenantId}`;

    // Create the tenant record
    await db.insert(tenants).values({
      id: tenantId,
      name: input.name,
      schemaName,
      status: "active",
      plan: input.plan,
      enabledModules: input.enabledModules,
      billingEmail: session.user.email,
    });

    // Provision the tenant schema (create tables via migrations)
    await provisionTenantSchema(schemaName);

    // Link user to tenant as owner
    await db.insert(tenantUsers).values({
      userId: session.user.id,
      tenantId,
      role: "owner",
      isOwner: true,
    });

    // Update user's tenantId in the auth table
    const sql = postgres(config.database.url);
    try {
      await sql`UPDATE "user" SET tenant_id = ${tenantId} WHERE id = ${session.user.id}`;
    } finally {
      await sql.end();
    }

    // Seed the organisation profile in the tenant schema
    const tenantSql = postgres(config.database.url);
    try {
      await tenantSql.unsafe(`SET search_path TO "${schemaName}"`);
      await tenantSql`
        INSERT INTO organisation (id, company_name, email, timezone, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${input.name}, ${session.user.email}, 'Australia/Brisbane', NOW(), NOW())
      `;
    } finally {
      await tenantSql.end();
    }

    return reply.status(201).send({
      success: true,
      data: {
        tenantId,
        schemaName,
        name: input.name,
        plan: input.plan,
      },
    });
  });
}
