import type { FastifyInstance } from "fastify";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  billingRuns,
  billingRunItems,
  invoices,
  invoiceLineItems,
  invoiceSequences,
  charges,
  arApprovals,
  companies,
  jobs,
  customerInvoiceSettings,
  organisation,
  documents,
  emailQueue,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createBillingRunSchema,
  billingRunPreviewSchema,
  batchVerifyInvoicesSchema,
  batchSendInvoicesSchema,
  sendRemittanceSchema,
  idParamSchema,
} from "@nexum/shared";
// z imported via @nexum/shared schemas
import { generateNextNumber } from "../services/invoice-number.js";
import {
  buildInvoiceLineItems,
  calculateInvoiceTotals,
} from "../services/invoice-builder.js";
import {
  generateInvoicePdf,
  generateRctiPdf,
} from "../services/pdf-generator.js";
import { uploadFile } from "../services/s3-client.js";
// email-service used via buildInvoiceEmailHtml/buildRemittanceEmailHtml helpers

/** Escape HTML special characters to prevent XSS in generated emails. */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Build invoice email HTML with all user data escaped. */
function buildInvoiceEmailHtml(invoiceNumber: string, totalAmount: string, dueDate: string): string {
  const safe = {
    num: escapeHtml(invoiceNumber),
    total: escapeHtml(totalAmount),
    due: escapeHtml(dueDate),
  };
  return [
    "<p>Please find attached your invoice ", safe.num, ".</p>",
    "<p>Amount due: $", safe.total, " AUD</p>",
    "<p>Due date: ", safe.due, "</p>",
    "<p>Thank you for your business.</p>",
  ].join("");
}

/** Build remittance advice email HTML with all user data escaped. */
function buildRemittanceEmailHtml(rctiNumber: string, periodStart: string, periodEnd: string, totalAmount: string): string {
  const safe = {
    num: escapeHtml(rctiNumber),
    start: escapeHtml(periodStart),
    end: escapeHtml(periodEnd),
    total: escapeHtml(totalAmount),
  };
  return [
    "<p>Please find attached your remittance advice for RCTI ", safe.num, ".</p>",
    "<p>Period: ", safe.start, " to ", safe.end, "</p>",
    "<p>Net payable: $", safe.total, " AUD</p>",
    "<p>Payment will be processed to your nominated bank account.</p>",
  ].join("");
}

export async function billingRunRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ══════════════════════════════════════════════════
  // ── List Billing Runs ──
  // ══════════════════════════════════════════════════

  app.get(
    "/",
    {
      preHandler: [requirePermission("manage:invoicing")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const runs = await db
        .select()
        .from(billingRuns)
        .orderBy(desc(billingRuns.createdAt))
        .limit(50);

      return reply.send({ success: true, data: runs });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Get Billing Run Detail ──
  // ══════════════════════════════════════════════════

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("manage:invoicing")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [run] = await db
        .select()
        .from(billingRuns)
        .where(eq(billingRuns.id, id));

      if (!run) {
        return reply.status(404).send({ success: false, error: "Billing run not found" });
      }

      const items = await db
        .select({
          item: billingRunItems,
          customer: companies,
        })
        .from(billingRunItems)
        .innerJoin(companies, eq(billingRunItems.customerId, companies.id))
        .where(eq(billingRunItems.billingRunId, id));

      return reply.send({ success: true, data: { ...run, items } });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Preview Billing Run ──
  // ══════════════════════════════════════════════════

  app.post(
    "/preview",
    {
      preHandler: [requirePermission("manage:invoicing")],
    },
    async (request, reply) => {
      const body = billingRunPreviewSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      // Find all AR-approved jobs in the period with uninvoiced charges
      const approvedCharges = await db
        .select({
          chargeId: charges.id,
          jobId: charges.jobId,
          partyId: charges.partyId,
          partyName: charges.partyName,
          total: charges.total,
        })
        .from(charges)
        .innerJoin(arApprovals, eq(charges.jobId, arApprovals.jobId))
        .where(
          and(
            eq(charges.status, "approved"),
            eq(charges.lineType, "revenue"),
            eq(arApprovals.status, "approved"),
            isNull(charges.invoiceId),
          ),
        );

      // Group by customer
      const customerCharges = new Map<string, {
        customerId: string;
        customerName: string;
        jobCount: number;
        chargeCount: number;
        estimatedTotal: number;
      }>();

      for (const charge of approvedCharges) {
        const customerId = charge.partyId ?? "unknown";
        const existing = customerCharges.get(customerId);
        if (existing) {
          existing.chargeCount++;
          existing.estimatedTotal += Number(charge.total);
        } else {
          customerCharges.set(customerId, {
            customerId,
            customerName: charge.partyName ?? "Unknown",
            jobCount: 1,
            chargeCount: 1,
            estimatedTotal: Number(charge.total),
          });
        }
      }

      // Filter by requested customers if specified
      let preview = Array.from(customerCharges.values());
      if (body.customerIds?.length) {
        preview = preview.filter((p) => body.customerIds!.includes(p.customerId));
      }

      return reply.send({
        success: true,
        data: {
          period: { start: body.periodStart, end: body.periodEnd },
          customerCount: preview.length,
          totalCharges: preview.reduce((sum, p) => sum + p.chargeCount, 0),
          estimatedTotal: preview.reduce((sum, p) => sum + p.estimatedTotal, 0),
          customers: preview,
        },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Create Billing Run (generate invoices) ──
  // ══════════════════════════════════════════════════

  app.post(
    "/",
    {
      preHandler: [requirePermission("manage:invoicing")],
    },
    async (request, reply) => {
      const body = createBillingRunSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      // Create billing run
      const [run] = await db.insert(billingRuns).values({
        status: "generating",
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        startedBy: ctx.userId,
        startedAt: new Date(),
      }).returning();

      // Find AR-approved revenue charges
      const approvedCharges = await db
        .select()
        .from(charges)
        .innerJoin(arApprovals, eq(charges.jobId, arApprovals.jobId))
        .where(
          and(
            eq(charges.status, "approved"),
            eq(charges.lineType, "revenue"),
            eq(arApprovals.status, "approved"),
            isNull(charges.invoiceId),
          ),
        );

      // Group by customer
      const byCustomer = new Map<string, typeof approvedCharges>();
      for (const row of approvedCharges) {
        const customerId = row.charges.partyId ?? "unknown";
        if (body.customerIds?.length && !body.customerIds.includes(customerId)) continue;
        const existing = byCustomer.get(customerId) ?? [];
        existing.push(row);
        byCustomer.set(customerId, existing);
      }

      let invoiceCount = 0;
      let totalAmount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Get invoice sequence
      const [sequence] = await db
        .select()
        .from(invoiceSequences)
        .where(eq(invoiceSequences.sequenceType, "invoice"));

      for (const [customerId, customerCharges] of byCustomer) {
        try {
          if (customerCharges.length === 0) {
            skippedCount++;
            continue;
          }

          // Get customer settings
          const [settings] = await db
            .select()
            .from(customerInvoiceSettings)
            .where(eq(customerInvoiceSettings.companyId, customerId));

          const paymentTerms = settings?.paymentTermsDays ?? 30;
          const issueDate = new Date().toISOString().slice(0, 10);
          const dueDate = new Date(Date.now() + paymentTerms * 24 * 60 * 60 * 1000)
            .toISOString().slice(0, 10);

          // Generate invoice number
          const generated = sequence
            ? generateNextNumber({
                prefix: sequence.prefix,
                suffix: sequence.suffix,
                nextNumber: sequence.nextNumber,
                minDigits: sequence.minDigits,
              })
            : { formatted: `INV-${String(invoiceCount + 1).padStart(4, "0")}`, nextValue: invoiceCount + 2 };
          const invoiceNumber = generated.formatted;

          // Build line items and totals — get job info for charge records
          const chargeRecords = customerCharges.map((c) => c.charges);
          const jobIds = [...new Set(chargeRecords.map((c) => c.jobId))];
          const jobInfoRows = jobIds.length > 0
            ? await db.select().from(jobs).where(inArray(jobs.id, jobIds))
            : [];
          const jobInfoForBuilder = jobInfoRows.map((j) => ({
            id: j.id,
            jobNumber: j.jobNumber ?? null,
            poNumber: null,
            projectId: j.projectId ?? null,
            customerId,
          }));
          const lineItemsData = buildInvoiceLineItems(chargeRecords, jobInfoForBuilder);
          const totals = calculateInvoiceTotals(lineItemsData);

          // Create invoice
          const [invoice] = await db.insert(invoices).values({
            invoiceNumber,
            customerId,
            status: "draft",
            issueDate,
            dueDate,
            subtotal: String(totals.subtotal),
            total: String(totals.total),
            groupingMode: settings?.invoiceGrouping ?? "combine_all",
            billingRunId: run!.id,
          }).returning();

          // Create line items
          for (let i = 0; i < lineItemsData.length; i++) {
            const li = lineItemsData[i]!;
            await db.insert(invoiceLineItems).values({
              invoiceId: invoice!.id,
              lineNumber: i + 1,
              chargeId: li.chargeId,
              jobId: li.jobId,
              description: li.description,
              quantity: String(li.quantity),
              unitOfMeasure: li.unitOfMeasure,
              unitPrice: String(li.unitPrice),
              lineTotal: String(li.lineTotal),
              sourceJobNumber: li.sourceJobNumber,
            });
          }

          // Update charges with invoice ID
          const chargeIds = chargeRecords.map((c) => c.id);
          if (chargeIds.length > 0) {
            await db
              .update(charges)
              .set({ invoiceId: invoice!.id, status: "invoiced" })
              .where(inArray(charges.id, chargeIds));
          }

          // Create billing run item
          await db.insert(billingRunItems).values({
            billingRunId: run!.id,
            customerId,
            invoiceId: invoice!.id,
            status: "generated",
            jobCount: new Set(chargeRecords.map((c) => c.jobId)).size,
            estimatedTotal: String(totals.total),
            actualTotal: String(totals.total),
          });

          // Update sequence
          if (sequence) {
            await db
              .update(invoiceSequences)
              .set({ nextNumber: sequence.nextNumber + 1 })
              .where(eq(invoiceSequences.id, sequence.id));
            sequence.nextNumber++;
          }

          invoiceCount++;
          totalAmount += totals.total;
        } catch (err) {
          errorCount++;
          const errorMessage = err instanceof Error ? err.message : "Invoice generation failed";
          await db.insert(billingRunItems).values({
            billingRunId: run!.id,
            customerId,
            status: "failed",
            jobCount: 0,
            estimatedTotal: "0",
            errorMessage,
          });
        }
      }

      // Update billing run
      await db
        .update(billingRuns)
        .set({
          status: errorCount > 0 && invoiceCount === 0 ? "failed" : "generated",
          customerCount: byCustomer.size,
          invoiceCount,
          totalAmount: String(totalAmount),
          skippedCount,
          errorCount,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(billingRuns.id, run!.id));

      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "billing_run",
        entityId: run!.id,
        newData: { invoiceCount, totalAmount, skippedCount, errorCount },
      });

      return reply.status(201).send({
        success: true,
        data: {
          billingRunId: run!.id,
          invoiceCount,
          totalAmount,
          skippedCount,
          errorCount,
        },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Batch Verify Invoices ──
  // ══════════════════════════════════════════════════

  app.post(
    "/batch-verify",
    {
      preHandler: [requirePermission("verify:invoicing")],
    },
    async (request, reply) => {
      const body = batchVerifyInvoicesSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      let verifiedCount = 0;
      let failedCount = 0;

      for (const invoiceId of body.invoiceIds) {
        const [invoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoiceId));

        if (!invoice || invoice.status !== "draft") {
          failedCount++;
          continue;
        }

        await db
          .update(invoices)
          .set({
            status: "verified",
            verifiedBy: ctx.userId,
            verifiedAt: new Date(),
            verificationNotes: body.notes,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId));

        verifiedCount++;
      }

      return reply.send({
        success: true,
        data: { verifiedCount, failedCount },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Batch Send Invoices ──
  // ══════════════════════════════════════════════════

  app.post(
    "/batch-send",
    {
      preHandler: [requirePermission("send:invoicing")],
    },
    async (request, reply) => {
      const body = batchSendInvoicesSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      let sentCount = 0;
      let failedCount = 0;

      // Get organisation details for PDFs
      const [org] = await db.select().from(organisation).limit(1);

      for (const invoiceId of body.invoiceIds) {
        const [invoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, invoiceId));

        if (!invoice || invoice.status !== "verified") {
          failedCount++;
          continue;
        }

        try {
          // Get customer
          const [customer] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, invoice.customerId));

          // Get line items
          const lineItems = await db
            .select()
            .from(invoiceLineItems)
            .where(eq(invoiceLineItems.invoiceId, invoiceId));

          // Generate PDF
          if (org && customer) {
            const pdfBuffer = await generateInvoicePdf({
              organisation: org,
              invoice,
              customer,
              lineItems,
              isDraft: false,
            });

            // Store PDF in S3
            const s3Key = `${ctx.tenantId}/invoices/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${invoice.invoiceNumber}.pdf`;
            await uploadFile(s3Key, pdfBuffer, "application/pdf");

            // Create document record
            const [pdfDoc] = await db.insert(documents).values({
              entityType: "invoice",
              entityId: invoiceId,
              documentType: "invoice_pdf",
              fileName: `${invoice.invoiceNumber}.pdf`,
              originalFileName: `${invoice.invoiceNumber}.pdf`,
              mimeType: "application/pdf",
              fileSize: pdfBuffer.length,
              s3Key,
              s3Bucket: process.env["SPACES_BUCKET"] ?? "nexum-documents",
              uploadedBy: ctx.userId,
              uploadSource: "system",
            }).returning();

            // Link PDF to invoice
            await db
              .update(invoices)
              .set({ pdfDocumentId: pdfDoc!.id })
              .where(eq(invoices.id, invoiceId));

            // Queue email if requested
            if (body.sendEmail && customer.email) {
              const invoiceEmailHtml = buildInvoiceEmailHtml(
                invoice.invoiceNumber,
                Number(invoice.total).toFixed(2),
                invoice.dueDate,
              );

              await db.insert(emailQueue).values({
                toAddresses: [customer.email],
                subject: "Invoice ".concat(invoice.invoiceNumber, " from ", org.companyName),
                htmlBody: invoiceEmailHtml,
                textBody: "Invoice ".concat(invoice.invoiceNumber, "\nAmount: $", Number(invoice.total).toFixed(2), " AUD\nDue: ", invoice.dueDate),
                attachments: [{
                  fileName: invoice.invoiceNumber.concat(".pdf"),
                  mimeType: "application/pdf",
                  documentId: pdfDoc!.id,
                }],
                entityType: "invoice",
                entityId: invoiceId,
                createdBy: ctx.userId,
              });
            }
          }

          // Update invoice status
          await db
            .update(invoices)
            .set({
              status: "sent",
              sentAt: new Date(),
              sentBy: ctx.userId,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoiceId));

          sentCount++;
        } catch (err) {
          failedCount++;
          app.log.error(`Failed to send invoice ${invoiceId}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      return reply.send({
        success: true,
        data: { sentCount, failedCount },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Invoice PDF Preview ──
  // ══════════════════════════════════════════════════

  app.get(
    "/invoice/:id/pdf-preview",
    {
      preHandler: [requirePermission("view:invoicing")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

      if (!invoice) {
        return reply.status(404).send({ success: false, error: "Invoice not found" });
      }

      const [org] = await db.select().from(organisation).limit(1);
      const [customer] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, invoice.customerId));

      const lineItems = await db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, id));

      if (!org || !customer) {
        return reply.status(400).send({ success: false, error: "Missing organisation or customer data" });
      }

      const isDraft = ["draft", "rejected"].includes(invoice.status);
      const pdfBuffer = await generateInvoicePdf({
        organisation: org,
        invoice,
        customer,
        lineItems,
        isDraft,
      });

      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `inline; filename="${invoice.invoiceNumber}-preview.pdf"`)
        .send(pdfBuffer);
    },
  );

  // ══════════════════════════════════════════════════
  // ── Send Remittance Advice ──
  // ══════════════════════════════════════════════════

  app.post(
    "/send-remittance",
    {
      preHandler: [requirePermission("manage:rcti")],
    },
    async (request, reply) => {
      const body = sendRemittanceSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [org] = await db.select().from(organisation).limit(1);
      if (!org) {
        return reply.status(400).send({ success: false, error: "Organisation not configured" });
      }

      let sentCount = 0;
      let failedCount = 0;
      const { rctis: rctiTable, rctiLineItems: rctiLineItemsTable } = await import("../db/schema/tenant.js");

      for (const rctiId of body.rctiIds) {
        const [rcti] = await db
          .select()
          .from(rctiTable)
          .where(eq(rctiTable.id, rctiId));

        if (!rcti || !["approved", "sent"].includes(rcti.status)) {
          failedCount++;
          continue;
        }

        try {
          const [contractor] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, rcti.contractorId));

          if (!contractor?.email) {
            failedCount++;
            continue;
          }

          const lineItems = await db
            .select()
            .from(rctiLineItemsTable)
            .where(eq(rctiLineItemsTable.rctiId, rctiId));

          const chargeItems = lineItems.filter((li) => li.lineType === "charge");
          const deductionItems = lineItems.filter((li) => li.lineType === "deduction");

          // Generate remittance PDF
          const pdfBuffer = await generateRctiPdf({
            organisation: org,
            rcti,
            contractor,
            chargeItems,
            deductionItems,
          });

          // Store PDF
          const s3Key = `${ctx.tenantId}/rctis/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${rcti.rctiNumber}.pdf`;
          await uploadFile(s3Key, pdfBuffer, "application/pdf");

          const [pdfDoc] = await db.insert(documents).values({
            entityType: "rcti",
            entityId: rctiId,
            documentType: "rcti_pdf",
            fileName: `${rcti.rctiNumber}.pdf`,
            originalFileName: `${rcti.rctiNumber}.pdf`,
            mimeType: "application/pdf",
            fileSize: pdfBuffer.length,
            s3Key,
            s3Bucket: process.env["SPACES_BUCKET"] ?? "nexum-documents",
            uploadedBy: ctx.userId,
            uploadSource: "system",
          }).returning();

          // Queue email
          const subjectTemplate = org.rctiSubjectTemplate ?? "Remittance Advice - RCTI {rcti_number}";
          const subject = subjectTemplate.replace("{rcti_number}", rcti.rctiNumber);

          const remittanceEmailHtml = buildRemittanceEmailHtml(
            rcti.rctiNumber,
            rcti.periodStart,
            rcti.periodEnd,
            Number(rcti.total).toFixed(2),
          );

          await db.insert(emailQueue).values({
            toAddresses: [contractor.email],
            subject,
            htmlBody: remittanceEmailHtml,
            textBody: "Remittance Advice - RCTI ".concat(rcti.rctiNumber, "\nPeriod: ", rcti.periodStart, " to ", rcti.periodEnd, "\nNet payable: $", Number(rcti.total).toFixed(2), " AUD"),
            attachments: [{
              fileName: `${rcti.rctiNumber}.pdf`,
              mimeType: "application/pdf",
              documentId: pdfDoc!.id,
            }],
            entityType: "rcti",
            entityId: rctiId,
            staggerDelayMs: org.rctiEmailStaggerSeconds * 1000,
            createdBy: ctx.userId,
          });

          // Update RCTI
          await db
            .update(rctiTable)
            .set({
              remittanceEmailedAt: new Date(),
              remittancePdfDocumentId: pdfDoc!.id,
              updatedAt: new Date(),
            })
            .where(eq(rctiTable.id, rctiId));

          sentCount++;
        } catch (err) {
          failedCount++;
          app.log.error(`Failed to send remittance for RCTI ${rctiId}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      return reply.send({
        success: true,
        data: { sentCount, failedCount },
      });
    },
  );
}
