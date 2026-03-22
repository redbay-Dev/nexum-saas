import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  notifications,
  notificationPreferences,
  communicationLog,
  emailQueue,
} from "../db/schema/tenant.js";
import {
  notificationQuerySchema,
  markNotificationsSchema,
  updateNotificationPreferencesSchema,
  communicationLogQuerySchema,
  queueEmailSchema,
} from "@nexum/shared";
import {
  sendEmail,
  determineEmailStatus,
  htmlToText,
} from "../services/email-service.js";

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ══════════════════════════════════════════════════
  // ── List Notifications ──
  // ══════════════════════════════════════════════════

  app.get(
    "/",
    {
      preHandler: [requirePermission("view:notifications")],
    },
    async (request, reply) => {
      const query = notificationQuerySchema.parse(request.query);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const conditions = [eq(notifications.userId, ctx.userId)];

      if (query.status) {
        conditions.push(eq(notifications.status, query.status));
      }
      if (query.category) {
        conditions.push(eq(notifications.category, query.category));
      }
      if (query.cursor) {
        conditions.push(sql`${notifications.createdAt} < ${query.cursor}`);
      }

      const rows = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      const data = hasMore ? rows.slice(0, query.limit) : rows;

      // Unread count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, ctx.userId),
            eq(notifications.status, "unread"),
          ),
        );

      return reply.send({
        success: true,
        data,
        unreadCount: Number(countResult?.count ?? 0),
        nextCursor: hasMore ? data[data.length - 1]?.createdAt?.toISOString() : null,
        hasMore,
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Mark Notifications Read/Dismissed ──
  // ══════════════════════════════════════════════════

  app.post(
    "/mark",
    {
      preHandler: [requirePermission("view:notifications")],
    },
    async (request, reply) => {
      const body = markNotificationsSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const now = new Date();
      let updatedCount = 0;

      for (const notifId of body.notificationIds) {
        const updateData: Record<string, unknown> = {
          status: body.status,
        };
        if (body.status === "read") {
          updateData["readAt"] = now;
        } else {
          updateData["dismissedAt"] = now;
        }

        const result = await db
          .update(notifications)
          .set(updateData)
          .where(
            and(
              eq(notifications.id, notifId),
              eq(notifications.userId, ctx.userId),
            ),
          )
          .returning();

        if (result.length > 0) updatedCount++;
      }

      return reply.send({ success: true, data: { updatedCount } });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Mark All Read ──
  // ══════════════════════════════════════════════════

  app.post(
    "/mark-all-read",
    {
      preHandler: [requirePermission("view:notifications")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      await db
        .update(notifications)
        .set({ status: "read", readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, ctx.userId),
            eq(notifications.status, "unread"),
          ),
        );

      return reply.send({ success: true });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Get Notification Preferences ──
  // ══════════════════════════════════════════════════

  app.get(
    "/preferences",
    {
      preHandler: [requirePermission("view:notifications")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, ctx.userId));

      if (!prefs) {
        // Return defaults
        return reply.send({
          success: true,
          data: {
            globalEnabled: true,
            pushEnabled: true,
            emailEnabled: true,
            smsEnabled: true,
            inAppEnabled: true,
            quietHoursStart: null,
            quietHoursEnd: null,
            channelOverrides: null,
          },
        });
      }

      return reply.send({ success: true, data: prefs });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Update Notification Preferences ──
  // ══════════════════════════════════════════════════

  app.put(
    "/preferences",
    {
      preHandler: [requirePermission("view:notifications")],
    },
    async (request, reply) => {
      const body = updateNotificationPreferencesSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [existing] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, ctx.userId));

      let result;
      if (existing) {
        [result] = await db
          .update(notificationPreferences)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(notificationPreferences.userId, ctx.userId))
          .returning();
      } else {
        [result] = await db
          .insert(notificationPreferences)
          .values({
            userId: ctx.userId,
            ...body,
          })
          .returning();
      }

      return reply.send({ success: true, data: result });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Queue Email ──
  // ══════════════════════════════════════════════════

  app.post(
    "/email",
    {
      preHandler: [requirePermission("send:invoicing")],
    },
    async (request, reply) => {
      const body = queueEmailSchema.parse(request.body);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const [queued] = await db.insert(emailQueue).values({
        toAddresses: body.to,
        ccAddresses: body.cc ?? null,
        bccAddresses: body.bcc ?? null,
        subject: body.subject,
        htmlBody: body.htmlBody,
        textBody: body.textBody ?? htmlToText(body.htmlBody),
        attachments: body.attachments ?? null,
        entityType: body.entityType,
        entityId: body.entityId,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        staggerDelayMs: body.staggerDelayMs ?? 0,
        createdBy: ctx.userId,
      }).returning();

      return reply.status(201).send({ success: true, data: queued });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Process Email Queue (admin trigger) ──
  // ══════════════════════════════════════════════════

  app.post(
    "/email/process",
    {
      preHandler: [requirePermission("manage:notifications")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      // Get pending emails
      const pendingEmails = await db
        .select()
        .from(emailQueue)
        .where(
          sql`${emailQueue.status} IN ('pending', 'queued')
              AND (${emailQueue.scheduledAt} IS NULL OR ${emailQueue.scheduledAt} <= NOW())
              AND ${emailQueue.retryCount} < ${emailQueue.maxRetries}`,
        )
        .orderBy(emailQueue.createdAt)
        .limit(10);

      let sentCount = 0;
      let failedCount = 0;

      for (const email of pendingEmails) {
        // Apply stagger delay
        if (email.staggerDelayMs > 0 && sentCount > 0) {
          await new Promise((resolve) => setTimeout(resolve, email.staggerDelayMs));
        }

        const result = await sendEmail({
          to: email.toAddresses,
          cc: email.ccAddresses ?? undefined,
          bcc: email.bccAddresses ?? undefined,
          subject: email.subject,
          htmlBody: email.htmlBody,
          textBody: email.textBody ?? undefined,
        });

        const newStatus = determineEmailStatus(
          result.success,
          email.retryCount,
          email.maxRetries,
        );

        await db
          .update(emailQueue)
          .set({
            status: newStatus,
            sentAt: result.success ? new Date() : undefined,
            errorMessage: result.error,
            retryCount: result.success ? email.retryCount : email.retryCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(emailQueue.id, email.id));

        // Log to communication log
        await db.insert(communicationLog).values({
          channel: "email",
          communicationType: "invoice_delivery",
          recipient: email.toAddresses.join(", "),
          subject: email.subject,
          bodyPreview: email.htmlBody.slice(0, 200),
          entityType: email.entityType,
          entityId: email.entityId,
          status: newStatus,
          sentAt: result.success ? new Date() : null,
          errorMessage: result.error,
          createdBy: email.createdBy,
        });

        if (result.success) sentCount++;
        else failedCount++;
      }

      return reply.send({
        success: true,
        data: { processed: pendingEmails.length, sentCount, failedCount },
      });
    },
  );

  // ══════════════════════════════════════════════════
  // ── Communication Log ──
  // ══════════════════════════════════════════════════

  app.get(
    "/log",
    {
      preHandler: [requirePermission("view:notifications")],
    },
    async (request, reply) => {
      const query = communicationLogQuerySchema.parse(request.query);
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const conditions: ReturnType<typeof eq>[] = [];

      if (query.entityType) {
        conditions.push(eq(communicationLog.entityType, query.entityType));
      }
      if (query.entityId) {
        conditions.push(eq(communicationLog.entityId, query.entityId));
      }
      if (query.channel) {
        conditions.push(eq(communicationLog.channel, query.channel));
      }
      if (query.cursor) {
        conditions.push(sql`${communicationLog.createdAt} < ${query.cursor}` as ReturnType<typeof eq>);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(communicationLog)
        .where(whereClause)
        .orderBy(desc(communicationLog.createdAt))
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
  // ── Email Queue Status ──
  // ══════════════════════════════════════════════════

  app.get(
    "/email/queue",
    {
      preHandler: [requirePermission("manage:notifications")],
    },
    async (request, reply) => {
      const ctx = tenant(request);
      const db = ctx.tenantDb;

      const rows = await db
        .select()
        .from(emailQueue)
        .orderBy(desc(emailQueue.createdAt))
        .limit(50);

      return reply.send({ success: true, data: rows });
    },
  );
}
