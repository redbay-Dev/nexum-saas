import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  xeroConnection,
  xeroAccounts,
  xeroTaxRates,
  xeroTrackingCategories,
  xeroAccountMappings,
  xeroContactLinks,
  xeroSyncLog,
  invoices,
  invoiceLineItems,
  rctis,
  rctiLineItems,
  companies,
  auditLog,
} from "../db/schema/tenant.js";
import {
  xeroAccountMappingSchema,
  xeroSyncSettingsSchema,
  xeroSyncInvoicesSchema,
  xeroSyncBillsSchema,
  xeroLinkContactSchema,
  xeroReconciliationQuerySchema,
  idParamSchema,
} from "@nexum/shared";
import { z } from "zod"; // used for inline schemas
import {
  buildAuthUrl,
  generatePKCE,
  exchangeCodeForTokens,
  refreshAccessToken,
  encryptToken,
  decryptToken,
  createXeroContact,
  createXeroInvoice,
  createXeroBill,
  getChartOfAccounts,
  getTaxRates,
  getTrackingCategories,
  validateWebhookSignature,
} from "../services/xero-client.js";

// In-memory PKCE state (per-tenant, short-lived)
const pkceStore = new Map<string, { codeVerifier: string; expiresAt: number }>();

export async function xeroRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ══════════════════════════════════════════════════
  // ── Connection Status ──
  // ══════════════════════════════════════════════════

  app.get(
    "/status",
    {
      preHandler: [requirePermission("view:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [connection] = await db.select().from(xeroConnection).limit(1);

      if (!connection) {
        return reply.send({
          success: true,
          data: { status: "disconnected", xeroOrgName: null },
        });
      }

      return reply.send({
        success: true,
        data: {
          status: connection.status,
          xeroOrgName: connection.xeroOrgName,
          connectedAt: connection.connectedAt,
          lastError: connection.lastError,
          autoCreateContacts: connection.autoCreateContacts,
          autoSyncPayments: connection.autoSyncPayments,
          pollIntervalMinutes: connection.pollIntervalMinutes,
        },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Initiate OAuth2 Connection ──
  // ══════════════════════════════════════════════════

  app.post(
    "/connect",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const { codeVerifier, codeChallenge } = generatePKCE();

      const state = `${ctx.tenantId}:${Date.now()}`;

      // Store PKCE verifier temporarily
      pkceStore.set(state, {
        codeVerifier,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      const authUrl = buildAuthUrl(codeChallenge, state);

      return reply.send({ success: true, data: { authUrl, state } });
    },
  );

  // ══════════════════════════════════════════════════
  // ── OAuth2 Callback ──
  // ══════════════════════════════════════════════════

  app.post(
    "/callback",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const body = z.object({
        code: z.string(),
        state: z.string(),
      }).parse(request.body);

      const ctx = tenant(request);
      const db = ctx.tenantDb;

      // Retrieve PKCE verifier
      const pkce = pkceStore.get(body.state);
      if (!pkce || pkce.expiresAt < Date.now()) {
        pkceStore.delete(body.state);
        return reply.status(400).send({
          success: false,
          error: "Invalid or expired state parameter",
        });
      }
      pkceStore.delete(body.state);

      try {
        const tokens = await exchangeCodeForTokens(body.code, pkce.codeVerifier);

        // Get Xero tenant ID from connections endpoint
        const connectionsResponse = await fetch("https://api.xero.com/connections", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const connections = await connectionsResponse.json() as Array<{
          tenantId: string;
          tenantName: string;
        }>;

        const xeroOrg = connections[0];
        if (!xeroOrg) {
          return reply.status(400).send({
            success: false,
            error: "No Xero organisation found",
          });
        }

        const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

        // Upsert connection
        const [existing] = await db.select().from(xeroConnection).limit(1);

        if (existing) {
          await db
            .update(xeroConnection)
            .set({
              xeroTenantId: xeroOrg.tenantId,
              xeroOrgName: xeroOrg.tenantName,
              status: "connected",
              accessTokenEncrypted: encryptToken(tokens.access_token),
              refreshTokenEncrypted: encryptToken(tokens.refresh_token),
              tokenExpiresAt: tokenExpiry,
              scopes: tokens.scope,
              connectedBy: ctx.userId,
              connectedAt: new Date(),
              lastError: null,
              updatedAt: new Date(),
            })
            .where(eq(xeroConnection.id, existing.id));
        } else {
          await db.insert(xeroConnection).values({
            xeroTenantId: xeroOrg.tenantId,
            xeroOrgName: xeroOrg.tenantName,
            status: "connected",
            accessTokenEncrypted: encryptToken(tokens.access_token),
            refreshTokenEncrypted: encryptToken(tokens.refresh_token),
            tokenExpiresAt: tokenExpiry,
            scopes: tokens.scope,
            connectedBy: ctx.userId,
            connectedAt: new Date(),
          });
        }

        await db.insert(auditLog).values({
          userId: ctx.userId,
          action: "CREATE",
          entityType: "xero_connection",
          newData: { xeroOrgName: xeroOrg.tenantName },
        });

        return reply.send({
          success: true,
          data: {
            status: "connected",
            xeroOrgName: xeroOrg.tenantName,
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Connection failed";
        return reply.status(500).send({
          success: false,
          error: errorMessage,
        });
      }
    },
  );

  // ══════════════════════════════════════════════════
  // ── Disconnect ──
  // ══════════════════════════════════════════════════

  app.post(
    "/disconnect",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      await db
        .update(xeroConnection)
        .set({
          status: "disconnected",
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          tokenExpiresAt: null,
          disconnectedAt: new Date(),
          updatedAt: new Date(),
        });

      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "xero_connection",
        newData: { status: "disconnected" },
      });

      return reply.send({ success: true });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Update Sync Settings ──
  // ══════════════════════════════════════════════════

  app.put(
    "/settings",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const body = xeroSyncSettingsSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      await db
        .update(xeroConnection)
        .set({
          autoCreateContacts: body.autoCreateContacts,
          autoSyncPayments: body.autoSyncPayments,
          pollIntervalMinutes: body.pollIntervalMinutes,
          batchSize: body.batchSize,
          updatedAt: new Date(),
        });

      return reply.send({ success: true });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Chart of Accounts ──
  // ══════════════════════════════════════════════════

  app.get(
    "/accounts",
    {
      preHandler: [requirePermission("view:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const accounts = await db.select().from(xeroAccounts).orderBy(xeroAccounts.code);
      return reply.send({ success: true, data: accounts });
    },
  );

  app.post(
    "/accounts/sync",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const apiOptions = await getApiOptions(db);
      if (!apiOptions) {
        return reply.status(400).send({ success: false, error: "Xero not connected" });
      }

      try {
        const accounts = await getChartOfAccounts(apiOptions);
        const taxRates = await getTaxRates(apiOptions);
        const trackingCategories = await getTrackingCategories(apiOptions);

        // Upsert accounts
        for (const account of accounts) {
          const [existing] = await db
            .select()
            .from(xeroAccounts)
            .where(eq(xeroAccounts.xeroAccountId, account.AccountID));

          if (existing) {
            await db
              .update(xeroAccounts)
              .set({
                code: account.Code,
                name: account.Name,
                accountType: account.Type,
                taxType: account.TaxType,
                status: account.Status,
                syncedAt: new Date(),
              })
              .where(eq(xeroAccounts.id, existing.id));
          } else {
            await db.insert(xeroAccounts).values({
              xeroAccountId: account.AccountID,
              code: account.Code,
              name: account.Name,
              accountType: account.Type,
              taxType: account.TaxType,
              status: account.Status,
            });
          }
        }

        // Upsert tax rates
        for (const rate of taxRates) {
          const [existing] = await db
            .select()
            .from(xeroTaxRates)
            .where(eq(xeroTaxRates.taxType, rate.TaxType));

          if (existing) {
            await db
              .update(xeroTaxRates)
              .set({
                name: rate.Name,
                effectiveRate: String(rate.EffectiveRate),
                status: rate.Status,
                syncedAt: new Date(),
              })
              .where(eq(xeroTaxRates.id, existing.id));
          } else {
            await db.insert(xeroTaxRates).values({
              name: rate.Name,
              taxType: rate.TaxType,
              effectiveRate: String(rate.EffectiveRate),
              status: rate.Status,
            });
          }
        }

        // Upsert tracking categories
        for (const cat of trackingCategories) {
          const [existing] = await db
            .select()
            .from(xeroTrackingCategories)
            .where(eq(xeroTrackingCategories.xeroCategoryId, cat.TrackingCategoryID));

          if (existing) {
            await db
              .update(xeroTrackingCategories)
              .set({
                name: cat.Name,
                status: cat.Status,
                options: cat.Options,
                syncedAt: new Date(),
              })
              .where(eq(xeroTrackingCategories.id, existing.id));
          } else {
            await db.insert(xeroTrackingCategories).values({
              xeroCategoryId: cat.TrackingCategoryID,
              name: cat.Name,
              status: cat.Status,
              options: cat.Options,
            });
          }
        }

        // Log sync
        await db.insert(xeroSyncLog).values({
          syncType: "chart_of_accounts",
          direction: "pull",
          status: "synced",
          triggeredBy: ctx.userId,
        });

        return reply.send({
          success: true,
          data: {
            accounts: accounts.length,
            taxRates: taxRates.length,
            trackingCategories: trackingCategories.length,
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Sync failed";
        await db.insert(xeroSyncLog).values({
          syncType: "chart_of_accounts",
          direction: "pull",
          status: "failed",
          errorMessage,
          triggeredBy: ctx.userId,
        });
        return reply.status(500).send({ success: false, error: errorMessage });
      }
    },
  );

  // ══════════════════════════════════════════════════
  // ── Account Mappings ──
  // ══════════════════════════════════════════════════

  app.get(
    "/mappings",
    {
      preHandler: [requirePermission("view:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const mappings = await db.select().from(xeroAccountMappings);
      return reply.send({ success: true, data: mappings });
    },
  );

  app.put(
    "/mappings/:id",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const body = xeroAccountMappingSchema.partial().parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [updated] = await db
        .update(xeroAccountMappings)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(xeroAccountMappings.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ success: false, error: "Mapping not found" });
      }

      return reply.send({ success: true, data: updated });
    },
  );

  app.post(
    "/mappings",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const body = xeroAccountMappingSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [mapping] = await db
        .insert(xeroAccountMappings)
        .values(body)
        .returning();

      return reply.status(201).send({ success: true, data: mapping });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Contact Links ──
  // ══════════════════════════════════════════════════

  app.get(
    "/contacts",
    {
      preHandler: [requirePermission("view:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const links = await db
        .select({
          link: xeroContactLinks,
          company: companies,
        })
        .from(xeroContactLinks)
        .innerJoin(companies, eq(xeroContactLinks.companyId, companies.id));

      return reply.send({ success: true, data: links });
    },
  );

  app.post(
    "/contacts/link",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const body = xeroLinkContactSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, body.companyId));

      if (!company) {
        return reply.status(404).send({ success: false, error: "Company not found" });
      }

      const [link] = await db
        .insert(xeroContactLinks)
        .values({
          companyId: body.companyId,
          xeroContactId: body.xeroContactId,
          isCustomer: company.isCustomer,
          isSupplier: company.isContractor || company.isSupplier,
        })
        .onConflictDoUpdate({
          target: xeroContactLinks.companyId,
          set: {
            xeroContactId: body.xeroContactId,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "xero_contact_link",
        entityId: link!.id,
        newData: { companyId: body.companyId, xeroContactId: body.xeroContactId },
      });

      return reply.status(201).send({ success: true, data: link });
    },
  );

  app.post(
    "/contacts/sync",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const body = z.object({
        companyIds: z.array(z.uuid()).min(1).max(50),
      }).parse(request.body);

      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const apiOptions = await getApiOptions(db);
      if (!apiOptions) {
        return reply.status(400).send({ success: false, error: "Xero not connected" });
      }

      let syncedCount = 0;
      let failedCount = 0;

      for (const companyId of body.companyIds) {
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, companyId));

        if (!company) continue;

        // Check if already linked
        const [existingLink] = await db
          .select()
          .from(xeroContactLinks)
          .where(eq(xeroContactLinks.companyId, companyId));

        if (existingLink) {
          syncedCount++;
          continue;
        }

        try {
          const xeroContact = await createXeroContact(apiOptions, {
            name: company.name,
            abn: company.abn ?? undefined,
            email: company.email ?? undefined,
            phone: company.phone ?? undefined,
            isCustomer: company.isCustomer,
            isSupplier: company.isContractor || company.isSupplier,
          });

          await db.insert(xeroContactLinks).values({
            companyId,
            xeroContactId: xeroContact.ContactID,
            isCustomer: company.isCustomer,
            isSupplier: company.isContractor || company.isSupplier,
          });

          await db.insert(xeroSyncLog).values({
            syncType: "contact",
            direction: "push",
            resourceId: companyId,
            xeroResourceId: xeroContact.ContactID,
            status: "synced",
            triggeredBy: ctx.userId,
          });

          syncedCount++;
        } catch (err) {
          failedCount++;
          const errorMessage = err instanceof Error ? err.message : "Contact sync failed";
          await db.insert(xeroSyncLog).values({
            syncType: "contact",
            direction: "push",
            resourceId: companyId,
            status: "failed",
            errorMessage,
            triggeredBy: ctx.userId,
          });
        }
      }

      return reply.send({
        success: true,
        data: { syncedCount, failedCount },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Sync Invoices to Xero ──
  // ══════════════════════════════════════════════════

  app.post(
    "/sync/invoices",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const body = xeroSyncInvoicesSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const apiOptions = await getApiOptions(db);
      if (!apiOptions) {
        return reply.status(400).send({ success: false, error: "Xero not connected" });
      }

      let syncedCount = 0;
      let failedCount = 0;
      const results: Array<{ invoiceId: string; status: string; error?: string }> = [];

      for (const invoiceId of body.invoiceIds) {
        const [invoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoiceId));

        if (!invoice) {
          results.push({ invoiceId, status: "skipped", error: "Not found" });
          continue;
        }

        if (invoice.xeroInvoiceId) {
          results.push({ invoiceId, status: "skipped", error: "Already synced" });
          continue;
        }

        // Get Xero contact link
        const [contactLink] = await db
          .select()
          .from(xeroContactLinks)
          .where(eq(xeroContactLinks.companyId, invoice.customerId));

        if (!contactLink) {
          results.push({ invoiceId, status: "failed", error: "Customer not linked to Xero" });
          failedCount++;
          continue;
        }

        // Get line items
        const lineItems = await db
          .select()
          .from(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoiceId));

        // Default revenue account code (mappings used via category lookup in future)
        const defaultRevenueCode = "200";

        try {
          const xeroInvoice = await createXeroInvoice(apiOptions, {
            contactId: contactLink.xeroContactId,
            invoiceNumber: invoice.invoiceNumber,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            lineItems: lineItems.map((li) => ({
              description: li.description,
              quantity: Number(li.quantity),
              unitAmount: Number(li.unitPrice),
              accountCode: li.accountCode ?? defaultRevenueCode,
            })),
          });

          // Update invoice with Xero ID
          await db
            .update(invoices)
            .set({
              xeroInvoiceId: xeroInvoice.InvoiceID,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoiceId));

          await db.insert(xeroSyncLog).values({
            syncType: "invoice",
            direction: "push",
            resourceId: invoiceId,
            xeroResourceId: xeroInvoice.InvoiceID,
            status: "synced",
            triggeredBy: ctx.userId,
          });

          results.push({ invoiceId, status: "synced" });
          syncedCount++;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Sync failed";
          results.push({ invoiceId, status: "failed", error: errorMessage });
          failedCount++;

          await db.insert(xeroSyncLog).values({
            syncType: "invoice",
            direction: "push",
            resourceId: invoiceId,
            status: "failed",
            errorMessage,
            triggeredBy: ctx.userId,
          });
        }
      }

      return reply.send({
        success: true,
        data: { syncedCount, failedCount, results },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Sync RCTIs as Bills to Xero ──
  // ══════════════════════════════════════════════════

  app.post(
    "/sync/bills",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const body = xeroSyncBillsSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const apiOptions = await getApiOptions(db);
      if (!apiOptions) {
        return reply.status(400).send({ success: false, error: "Xero not connected" });
      }

      let syncedCount = 0;
      let failedCount = 0;
      const results: Array<{ rctiId: string; status: string; error?: string }> = [];

      for (const rctiId of body.rctiIds) {
        const [rcti] = await db
          .select()
          .from(rctis)
          .where(eq(rctis.id, rctiId));

        if (!rcti) {
          results.push({ rctiId, status: "skipped", error: "Not found" });
          continue;
        }

        if (rcti.xeroBillId) {
          results.push({ rctiId, status: "skipped", error: "Already synced" });
          continue;
        }

        const [contactLink] = await db
          .select()
          .from(xeroContactLinks)
          .where(eq(xeroContactLinks.companyId, rcti.contractorId));

        if (!contactLink) {
          // Auto-create contact if configured
          const [connection] = await db.select().from(xeroConnection).limit(1);
          if (connection?.autoCreateContacts) {
            const [contractor] = await db.select().from(companies).where(eq(companies.id, rcti.contractorId));
            if (contractor) {
              try {
                const xeroContact = await createXeroContact(apiOptions, {
                  name: contractor.name,
                  abn: contractor.abn ?? undefined,
                  email: contractor.email ?? undefined,
                  phone: contractor.phone ?? undefined,
                  isCustomer: false,
                  isSupplier: true,
                });
                await db.insert(xeroContactLinks).values({
                  companyId: rcti.contractorId,
                  xeroContactId: xeroContact.ContactID,
                  isCustomer: false,
                  isSupplier: true,
                });
              } catch {
                results.push({ rctiId, status: "failed", error: "Failed to auto-create Xero contact" });
                failedCount++;
                continue;
              }
            }
          } else {
            results.push({ rctiId, status: "failed", error: "Contractor not linked to Xero" });
            failedCount++;
            continue;
          }
        }

        // Re-fetch link after potential auto-create
        const [link] = await db
          .select()
          .from(xeroContactLinks)
          .where(eq(xeroContactLinks.companyId, rcti.contractorId));

        if (!link) {
          results.push({ rctiId, status: "failed", error: "Contractor not linked" });
          failedCount++;
          continue;
        }

        const lineItems = await db
          .select()
          .from(rctiLineItems)
          .where(eq(rctiLineItems.rctiId, rctiId));

        const defaultExpenseCode = "310";

        try {
          const xeroBill = await createXeroBill(apiOptions, {
            contactId: link.xeroContactId,
            reference: `RCTI ${rcti.rctiNumber} - Period ${rcti.periodStart} to ${rcti.periodEnd}`,
            issueDate: rcti.issueDate ?? rcti.periodEnd,
            dueDate: rcti.dueDate ?? rcti.periodEnd,
            lineItems: lineItems.map((li) => ({
              description: li.description,
              quantity: Number(li.quantity),
              unitAmount: li.lineType === "deduction"
                ? -Math.abs(Number(li.unitPrice))
                : Number(li.unitPrice),
              accountCode: defaultExpenseCode,
            })),
          });

          await db
            .update(rctis)
            .set({
              xeroBillId: xeroBill.InvoiceID,
              updatedAt: new Date(),
            })
            .where(eq(rctis.id, rctiId));

          await db.insert(xeroSyncLog).values({
            syncType: "bill",
            direction: "push",
            resourceId: rctiId,
            xeroResourceId: xeroBill.InvoiceID,
            status: "synced",
            triggeredBy: ctx.userId,
          });

          results.push({ rctiId, status: "synced" });
          syncedCount++;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Sync failed";
          results.push({ rctiId, status: "failed", error: errorMessage });
          failedCount++;

          await db.insert(xeroSyncLog).values({
            syncType: "bill",
            direction: "push",
            resourceId: rctiId,
            status: "failed",
            errorMessage,
            triggeredBy: ctx.userId,
          });
        }
      }

      return reply.send({
        success: true,
        data: { syncedCount, failedCount, results },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Tax Rates ──
  // ══════════════════════════════════════════════════

  app.get(
    "/tax-rates",
    {
      preHandler: [requirePermission("view:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const rates = await db.select().from(xeroTaxRates);
      return reply.send({ success: true, data: rates });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Tracking Categories ──
  // ══════════════════════════════════════════════════

  app.get(
    "/tracking-categories",
    {
      preHandler: [requirePermission("view:xero")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const categories = await db.select().from(xeroTrackingCategories);
      return reply.send({ success: true, data: categories });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Sync Log ──
  // ══════════════════════════════════════════════════

  app.get(
    "/sync-log",
    {
      preHandler: [requirePermission("view:xero")],
    },
    async (request, reply) => {
      const query = z.object({
        syncType: z.string().optional(),
        status: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }).parse(request.query);

      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const conditions: ReturnType<typeof eq>[] = [];
      if (query.syncType) {
        conditions.push(eq(xeroSyncLog.syncType, query.syncType));
      }
      if (query.status) {
        conditions.push(eq(xeroSyncLog.status, query.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(xeroSyncLog)
        .where(whereClause)
        .orderBy(desc(xeroSyncLog.createdAt))
        .limit(query.limit);

      return reply.send({ success: true, data: rows });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Reconciliation ──
  // ══════════════════════════════════════════════════

  app.get(
    "/reconciliation",
    {
      preHandler: [requirePermission("manage:xero")],
    },
    async (request, reply) => {
      const query = xeroReconciliationQuerySchema.parse(request.query);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      if (query.resourceType === "invoice") {
        // Get all invoices with Xero IDs
        const syncedInvoices = await db
          .select()
          .from(invoices)
          .where(sql`${invoices.xeroInvoiceId} IS NOT NULL`)
          .limit(query.limit);

        // Get all invoices that should be synced but aren't
        const unsyncedInvoices = await db
          .select()
          .from(invoices)
          .where(
            and(
              sql`${invoices.xeroInvoiceId} IS NULL`,
              sql`${invoices.status} IN ('verified', 'sent', 'partially_paid', 'paid')`,
            ),
          )
          .limit(query.limit);

        return reply.send({
          success: true,
          data: {
            synced: syncedInvoices,
            unsynced: unsyncedInvoices,
            syncedCount: syncedInvoices.length,
            unsyncedCount: unsyncedInvoices.length,
          },
        });
      }

      if (query.resourceType === "bill") {
        const syncedBills = await db
          .select()
          .from(rctis)
          .where(sql`${rctis.xeroBillId} IS NOT NULL`)
          .limit(query.limit);

        const unsyncedBills = await db
          .select()
          .from(rctis)
          .where(
            and(
              sql`${rctis.xeroBillId} IS NULL`,
              sql`${rctis.status} IN ('approved', 'sent', 'partially_paid', 'paid')`,
            ),
          )
          .limit(query.limit);

        return reply.send({
          success: true,
          data: {
            synced: syncedBills,
            unsynced: unsyncedBills,
            syncedCount: syncedBills.length,
            unsyncedCount: unsyncedBills.length,
          },
        });
      }

      // contacts
      const linkedContacts = await db
        .select({
          link: xeroContactLinks,
          company: companies,
        })
        .from(xeroContactLinks)
        .innerJoin(companies, eq(xeroContactLinks.companyId, companies.id))
        .limit(query.limit);

      return reply.send({
        success: true,
        data: {
          linked: linkedContacts,
          linkedCount: linkedContacts.length,
        },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Webhook Endpoint ──
  // ══════════════════════════════════════════════════

  app.post(
    "/webhook",
    async (request, reply) => {
      const webhookKey = process.env["XERO_WEBHOOK_KEY"] ?? "";
      const signature = (request.headers["x-xero-signature"] as string) ?? "";
      const rawBody = JSON.stringify(request.body);

      if (!validateWebhookSignature(rawBody, signature, webhookKey)) {
        return reply.status(401).send();
      }

      // Process events async
      const payload = request.body as { events?: Array<{ eventType: string; resourceId: string }> };

      if (payload.events) {
        for (const event of payload.events) {
          app.log.info(`Xero webhook event: ${event.eventType} for ${event.resourceId}`);
          // Payment events would be processed here via BullMQ in production
        }
      }

      // Xero expects 200 response
      return reply.status(200).send();
    },
  );
}

// ── Helper to get API options from connection ──

async function getApiOptions(
  db: ReturnType<typeof tenant>["tenantDb"],
): Promise<{ accessToken: string; xeroTenantId: string } | null> {
  const [connection] = await db.select().from(xeroConnection).limit(1);

  if (!connection || connection.status !== "connected" || !connection.accessTokenEncrypted || !connection.refreshTokenEncrypted) {
    return null;
  }

  // Check if token needs refresh (5 min buffer)
  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    try {
      const refreshToken = decryptToken(connection.refreshTokenEncrypted);
      const tokens = await refreshAccessToken(refreshToken);

      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

      await db
        .update(xeroConnection)
        .set({
          accessTokenEncrypted: encryptToken(tokens.access_token),
          refreshTokenEncrypted: encryptToken(tokens.refresh_token),
          tokenExpiresAt: tokenExpiry,
          updatedAt: new Date(),
        })
        .where(eq(xeroConnection.id, connection.id));

      return {
        accessToken: tokens.access_token,
        xeroTenantId: connection.xeroTenantId,
      };
    } catch {
      await db
        .update(xeroConnection)
        .set({
          status: "expired",
          lastError: "Token refresh failed — re-authorisation required",
          updatedAt: new Date(),
        })
        .where(eq(xeroConnection.id, connection.id));
      return null;
    }
  }

  return {
    accessToken: decryptToken(connection.accessTokenEncrypted),
    xeroTenantId: connection.xeroTenantId,
  };
}
