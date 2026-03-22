import type { FastifyInstance } from "fastify";
import { eq, and, isNull, ilike, or, desc, sql, lte, gte } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  documents,
  documentVersions,
  publicDocumentLinks,
  documentAccessLog,
  auditLog,
} from "../db/schema/tenant.js";
import {
  uploadDocumentSchema,
  updateDocumentSchema,
  createPublicLinkSchema,
  documentQuerySchema,
  batchDocumentActionSchema,
  idParamSchema,
} from "@nexum/shared";
import { z } from "zod";
import {
  generateUploadUrl,
  generateDownloadUrl,
  generateViewUrl,
  generateSecureToken,
  buildS3Key,
  buildStandardFileName,
  getFileExtension,
} from "../services/s3-client.js";

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ══════════════════════════════════════════════════
  // ── List Documents ──
  // ══════════════════════════════════════════════════

  app.get(
    "/",
    {
      preHandler: [requirePermission("view:documents")],
    },
    async (request, reply) => {
      const query = documentQuerySchema.parse(request.query);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const conditions = [isNull(documents.deletedAt)];

      if (query.entityType) {
        conditions.push(eq(documents.entityType, query.entityType));
      }
      if (query.entityId) {
        conditions.push(eq(documents.entityId, query.entityId));
      }
      if (query.documentType) {
        conditions.push(eq(documents.documentType, query.documentType));
      }
      if (query.status) {
        conditions.push(eq(documents.status, query.status));
      }
      if (query.search) {
        conditions.push(
          or(
            ilike(documents.fileName, `%${query.search}%`),
            ilike(documents.originalFileName, `%${query.search}%`),
          )!,
        );
      }
      if (query.expiringWithinDays) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + query.expiringWithinDays);
        const futureDateStr = futureDate.toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        conditions.push(lte(documents.expiryDate, futureDateStr));
        conditions.push(gte(documents.expiryDate, todayStr));
      }
      if (query.cursor) {
        conditions.push(sql`${documents.createdAt} < ${query.cursor}`);
      }

      const rows = await db
        .select()
        .from(documents)
        .where(and(...conditions))
        .orderBy(desc(documents.createdAt))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      const data = hasMore ? rows.slice(0, query.limit) : rows;

      return reply.send({
        success: true,
        data,
        nextCursor: hasMore ? data[data.length - 1]?.createdAt?.toISOString() : null,
        hasMore,
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Get Document Detail ──
  // ══════════════════════════════════════════════════

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("view:documents")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt)));

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      // Get versions
      const versions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, id))
        .orderBy(desc(documentVersions.versionNumber));

      // Generate view URL
      const viewUrl = await generateViewUrl(doc.s3Key);

      return reply.send({
        success: true,
        data: { ...doc, versions, viewUrl },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Get Upload URL (presigned) ──
  // ══════════════════════════════════════════════════

  app.post(
    "/upload-url",
    {
      preHandler: [requirePermission("upload:documents")],
    },
    async (request, reply) => {
      const body = uploadDocumentSchema.parse(request.body);
      const ctx = tenant(request);

      const ext = getFileExtension(body.fileName);
      const standardName = buildStandardFileName(
        body.entityType,
        body.documentType,
        new Date().toISOString().slice(0, 10),
        1,
        ext,
      );

      const s3Key = buildS3Key(
        ctx.tenantId,
        body.entityType,
        body.entityId,
        body.documentType,
        standardName,
      );

      const uploadUrl = await generateUploadUrl(s3Key, body.mimeType);

      return reply.send({
        success: true,
        data: {
          uploadUrl,
          s3Key,
          standardName,
        },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Confirm Upload (create document record) ──
  // ══════════════════════════════════════════════════

  app.post(
    "/",
    {
      preHandler: [requirePermission("upload:documents")],
    },
    async (request, reply) => {
      const body = uploadDocumentSchema.extend({
        s3Key: z.string(),
        checksum: z.string().optional(),
      }).parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const ext = getFileExtension(body.fileName);
      const standardName = buildStandardFileName(
        body.entityType,
        body.documentType,
        new Date().toISOString().slice(0, 10),
        1,
        ext,
      );

      const [doc] = await db
        .insert(documents)
        .values({
          entityType: body.entityType,
          entityId: body.entityId,
          documentType: body.documentType,
          fileName: standardName,
          originalFileName: body.fileName,
          mimeType: body.mimeType,
          fileSize: body.fileSize,
          s3Key: body.s3Key,
          s3Bucket: process.env["SPACES_BUCKET"] ?? "nexum-documents",
          checksum: body.checksum,
          issueDate: body.issueDate,
          expiryDate: body.expiryDate,
          metadata: body.metadata ?? null,
          notes: body.notes,
          uploadedBy: ctx.userId,
        })
        .returning();

      // Create initial version
      await db.insert(documentVersions).values({
        documentId: doc!.id,
        versionNumber: 1,
        fileName: standardName,
        mimeType: body.mimeType,
        fileSize: body.fileSize,
        s3Key: body.s3Key,
        checksum: body.checksum,
        isCurrent: true,
        uploadedBy: ctx.userId,
        uploadReason: "Initial upload",
      });

      // Audit log
      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "document",
        entityId: doc!.id,
        newData: { fileName: standardName, entityType: body.entityType, documentType: body.documentType },
      });

      return reply.status(201).send({ success: true, data: doc });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Update Document Metadata ──
  // ══════════════════════════════════════════════════

  app.put(
    "/:id",
    {
      preHandler: [requirePermission("manage:documents")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const body = updateDocumentSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [existing] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      const [updated] = await db
        .update(documents)
        .set({
          ...body,
          metadata: body.metadata ?? existing.metadata,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id))
        .returning();

      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "document",
        entityId: id,
        previousData: { fileName: existing.fileName, documentType: existing.documentType },
        newData: body,
      });

      return reply.send({ success: true, data: updated });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Delete Document (soft) ──
  // ══════════════════════════════════════════════════

  app.delete(
    "/:id",
    {
      preHandler: [requirePermission("manage:documents")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [existing] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      await db
        .update(documents)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(documents.id, id));

      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "document",
        entityId: id,
        previousData: { fileName: existing.fileName },
      });

      return reply.send({ success: true });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Download URL ──
  // ══════════════════════════════════════════════════

  app.get(
    "/:id/download",
    {
      preHandler: [requirePermission("download:documents")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt)));

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      const downloadUrl = await generateDownloadUrl(doc.s3Key, doc.fileName);

      // Log access
      await db.insert(documentAccessLog).values({
        documentId: id,
        accessMethod: "direct",
        action: "download",
        userId: ctx.userId,
      });

      return reply.send({ success: true, data: { downloadUrl } });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Version History ──
  // ══════════════════════════════════════════════════

  app.get(
    "/:id/versions",
    {
      preHandler: [requirePermission("view:documents")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const versions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, id))
        .orderBy(desc(documentVersions.versionNumber));

      return reply.send({ success: true, data: versions });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Create New Version (re-upload) ──
  // ══════════════════════════════════════════════════

  app.post(
    "/:id/versions",
    {
      preHandler: [requirePermission("upload:documents")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const body = z.object({
        s3Key: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSize: z.number().int().min(1),
        checksum: z.string().optional(),
        reason: z.string().max(500).optional(),
      }).parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt)));

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      const newVersion = doc.currentVersion + 1;

      // Unmark current version
      await db
        .update(documentVersions)
        .set({ isCurrent: false })
        .where(and(eq(documentVersions.documentId, id), eq(documentVersions.isCurrent, true)));

      // Create new version
      const [version] = await db.insert(documentVersions).values({
        documentId: id,
        versionNumber: newVersion,
        fileName: body.fileName,
        mimeType: body.mimeType,
        fileSize: body.fileSize,
        s3Key: body.s3Key,
        checksum: body.checksum,
        isCurrent: true,
        uploadedBy: ctx.userId,
        uploadReason: body.reason,
      }).returning();

      // Update document
      await db
        .update(documents)
        .set({
          currentVersion: newVersion,
          fileName: body.fileName,
          mimeType: body.mimeType,
          fileSize: body.fileSize,
          s3Key: body.s3Key,
          checksum: body.checksum,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "document",
        entityId: id,
        newData: { version: newVersion, reason: body.reason },
      });

      return reply.status(201).send({ success: true, data: version });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Create Public Share Link ──
  // ══════════════════════════════════════════════════

  app.post(
    "/share",
    {
      preHandler: [requirePermission("share:documents")],
    },
    async (request, reply) => {
      const body = createPublicLinkSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, body.documentId), isNull(documents.deletedAt)));

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      const token = generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + body.expiryDays);

      let passwordHash: string | undefined;
      if (body.password) {
        // Use crypto for password hashing (bcrypt would be better but avoiding extra deps)
        const encoder = new TextEncoder();
        const data = encoder.encode(body.password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        passwordHash = Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
      }

      const [link] = await db.insert(publicDocumentLinks).values({
        documentId: body.documentId,
        token,
        passwordHash,
        expiresAt,
        maxDownloads: body.maxDownloads,
        createdBy: ctx.userId,
      }).returning();

      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "public_link",
        entityId: link!.id,
        newData: { documentId: body.documentId, expiryDays: body.expiryDays },
      });

      return reply.status(201).send({
        success: true,
        data: {
          ...link,
          shareUrl: `/api/v1/public/documents/${token}`,
        },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Expiring Documents Dashboard ──
  // ══════════════════════════════════════════════════

  app.get(
    "/expiring",
    {
      preHandler: [requirePermission("view:documents")],
    },
    async (request, reply) => {
      const query = z.object({
        days: z.coerce.number().int().min(1).max(365).default(30),
      }).parse(request.query);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + query.days);
      const futureDateStr = futureDate.toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);

      const rows = await db
        .select()
        .from(documents)
        .where(
          and(
            isNull(documents.deletedAt),
            lte(documents.expiryDate, futureDateStr),
            sql`${documents.expiryDate} IS NOT NULL`,
          ),
        )
        .orderBy(documents.expiryDate);

      // Categorise: expired, expiring_soon (≤7d), expiring (≤30d), upcoming
      const categorised = rows.map((doc) => {
        const expiry = doc.expiryDate ?? "";
        let urgency: "expired" | "critical" | "warning" | "upcoming";
        if (expiry < todayStr) {
          urgency = "expired";
        } else {
          const daysUntil = Math.ceil(
            (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntil <= 7) urgency = "critical";
          else if (daysUntil <= 30) urgency = "warning";
          else urgency = "upcoming";
        }
        return { ...doc, urgency };
      });

      return reply.send({ success: true, data: categorised });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Batch Delete ──
  // ══════════════════════════════════════════════════

  app.post(
    "/batch-delete",
    {
      preHandler: [requirePermission("manage:documents")],
    },
    async (request, reply) => {
      const body = batchDocumentActionSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const now = new Date();
      let deletedCount = 0;

      for (const docId of body.documentIds) {
        const result = await db
          .update(documents)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(eq(documents.id, docId), isNull(documents.deletedAt)))
          .returning();

        if (result.length > 0) {
          deletedCount++;
          await db.insert(auditLog).values({
            userId: ctx.userId,
            action: "DELETE",
            entityType: "document",
            entityId: docId,
          });
        }
      }

      return reply.send({ success: true, data: { deletedCount } });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Restore from Trash ──
  // ══════════════════════════════════════════════════

  app.post(
    "/:id/restore",
    {
      preHandler: [requirePermission("manage:documents")],
    },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), sql`${documents.deletedAt} IS NOT NULL`));

      if (!doc) {
        return reply.status(404).send({ success: false, error: "Document not found in trash" });
      }

      const [restored] = await db
        .update(documents)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(documents.id, id))
        .returning();

      await db.insert(auditLog).values({
        userId: ctx.userId,
        action: "RESTORE",
        entityType: "document",
        entityId: id,
      });

      return reply.send({ success: true, data: restored });
    },
  );
}
