import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import {
  requireTenant,
  requirePermission,
  tenant,
} from "../middleware/tenant.js";
import {
  employees,
  companies,
  licences,
  medicals,
  qualifications,
  qualificationTypes,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  createLicenceSchema,
  updateLicenceSchema,
  createMedicalSchema,
  updateMedicalSchema,
  createQualificationSchema,
  updateQualificationSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const employeeListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.enum(["active", "on_leave", "suspended", "terminated"]).optional(),
  isDriver: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  contractorCompanyId: z.uuid().optional(),
});

type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

const employeeIdParamSchema = z.object({ employeeId: z.uuid() });

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── LIST ──

  app.get(
    "/",
    { preHandler: requirePermission("view:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = employeeListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: EmployeeListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(employees.deletedAt)];

      if (query.status) {
        conditions.push(eq(employees.status, query.status));
      }

      if (query.isDriver !== undefined) {
        conditions.push(eq(employees.isDriver, query.isDriver));
      }

      if (query.contractorCompanyId) {
        conditions.push(
          eq(employees.contractorCompanyId, query.contractorCompanyId),
        );
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(employees.firstName, searchPattern),
            ilike(employees.lastName, searchPattern),
            ilike(employees.email, searchPattern),
            ilike(employees.phone, searchPattern),
            ilike(employees.position, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${employees.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select()
        .from(employees)
        .where(and(...conditions))
        .orderBy(desc(employees.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(
          and(
            ...conditions.filter(
              (_, i) =>
                i !== conditions.length - (query.cursor ? 1 : 0),
            ),
          ),
        );

      return {
        success: true,
        data: {
          data,
          nextCursor,
          hasMore,
          total: countResult?.count ?? 0,
        },
      };
    },
  );

  // ── GET BY ID ──

  app.get(
    "/:id",
    { preHandler: requirePermission("view:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid employee ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [employee] = await ctx.tenantDb
        .select()
        .from(employees)
        .where(
          and(eq(employees.id, parsed.data.id), isNull(employees.deletedAt)),
        )
        .limit(1);

      if (!employee) {
        return reply
          .status(404)
          .send({ error: "Employee not found", code: "NOT_FOUND" });
      }

      // Fetch related data for drivers
      let employeeLicences: Array<typeof licences.$inferSelect> = [];
      let employeeMedicals: Array<typeof medicals.$inferSelect> = [];
      let employeeQualifications: Array<{
        id: string;
        qualificationTypeId: string;
        qualificationTypeName: string;
        referenceNumber: string | null;
        stateOfIssue: string | null;
        issuedDate: string | null;
        expiryDate: string | null;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
      }> = [];

      if (employee.isDriver) {
        employeeLicences = await ctx.tenantDb
          .select()
          .from(licences)
          .where(eq(licences.employeeId, employee.id))
          .orderBy(desc(licences.createdAt));

        employeeMedicals = await ctx.tenantDb
          .select()
          .from(medicals)
          .where(eq(medicals.employeeId, employee.id))
          .orderBy(desc(medicals.createdAt));
      }

      // Qualifications for all employees
      const qualRows = await ctx.tenantDb
        .select({
          id: qualifications.id,
          qualificationTypeId: qualifications.qualificationTypeId,
          qualificationTypeName: qualificationTypes.name,
          referenceNumber: qualifications.referenceNumber,
          stateOfIssue: qualifications.stateOfIssue,
          issuedDate: qualifications.issuedDate,
          expiryDate: qualifications.expiryDate,
          notes: qualifications.notes,
          createdAt: qualifications.createdAt,
          updatedAt: qualifications.updatedAt,
        })
        .from(qualifications)
        .innerJoin(
          qualificationTypes,
          eq(qualifications.qualificationTypeId, qualificationTypes.id),
        )
        .where(eq(qualifications.employeeId, employee.id))
        .orderBy(desc(qualifications.createdAt));

      employeeQualifications = qualRows;

      // Compute compliance status for drivers
      let complianceStatus: "compliant" | "non_compliant" | "expiring_soon" =
        "compliant";
      if (employee.isDriver) {
        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        // Check licence expiry
        for (const lic of employeeLicences) {
          const exp = new Date(lic.expiryDate);
          if (exp < now) {
            complianceStatus = "non_compliant";
            break;
          }
          if (exp.getTime() - now.getTime() < thirtyDaysMs) {
            complianceStatus = "expiring_soon";
          }
        }

        // Check medical expiry
        if (complianceStatus !== "non_compliant") {
          for (const med of employeeMedicals) {
            const exp = new Date(med.expiryDate);
            if (exp < now) {
              complianceStatus = "non_compliant";
              break;
            }
            if (exp.getTime() - now.getTime() < thirtyDaysMs) {
              complianceStatus = "expiring_soon";
            }
          }
        }

        // Check qualification expiry
        if (complianceStatus !== "non_compliant") {
          for (const qual of employeeQualifications) {
            if (qual.expiryDate) {
              const exp = new Date(qual.expiryDate);
              if (exp < now) {
                complianceStatus = "non_compliant";
                break;
              }
              if (exp.getTime() - now.getTime() < thirtyDaysMs) {
                complianceStatus = "expiring_soon";
              }
            }
          }
        }

        // No licence at all = non-compliant
        if (employeeLicences.length === 0) {
          complianceStatus = "non_compliant";
        }
      }

      return {
        success: true,
        data: {
          ...employee,
          licences: employeeLicences,
          medicals: employeeMedicals,
          qualifications: employeeQualifications,
          complianceStatus: employee.isDriver ? complianceStatus : null,
        },
      };
    },
  );

  // ── CREATE ──

  app.post(
    "/",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createEmployeeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid employee data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;

      // Verify contractor company exists if provided
      if (input.contractorCompanyId) {
        const [company] = await ctx.tenantDb
          .select({ id: companies.id, isContractor: companies.isContractor })
          .from(companies)
          .where(
            and(
              eq(companies.id, input.contractorCompanyId),
              isNull(companies.deletedAt),
            ),
          )
          .limit(1);
        if (!company) {
          return reply.status(400).send({
            error: "Contractor company not found",
            code: "INVALID_REFERENCE",
          });
        }
        if (!company.isContractor) {
          return reply.status(400).send({
            error: "Company is not a contractor",
            code: "VALIDATION_ERROR",
          });
        }
      }

      const id = crypto.randomUUID();

      const [employee] = await ctx.tenantDb
        .insert(employees)
        .values({
          id,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: input.dateOfBirth,
          phone: input.phone,
          email: input.email,
          homeAddress: input.homeAddress,
          position: input.position,
          employmentType: input.employmentType,
          startDate: input.startDate,
          department: input.department,
          isDriver: input.isDriver,
          contractorCompanyId: input.contractorCompanyId,
          emergencyContacts: input.emergencyContacts,
          status: input.status,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "employee",
        entityId: id,
        newData: employee,
      });

      return reply.status(201).send({ success: true, data: employee });
    },
  );

  // ── UPDATE ──

  app.put(
    "/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid employee ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateEmployeeSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid employee data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(employees)
        .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Employee not found", code: "NOT_FOUND" });
      }

      // Verify contractor company if changing
      if (input.contractorCompanyId) {
        const [company] = await ctx.tenantDb
          .select({ id: companies.id, isContractor: companies.isContractor })
          .from(companies)
          .where(
            and(
              eq(companies.id, input.contractorCompanyId),
              isNull(companies.deletedAt),
            ),
          )
          .limit(1);
        if (!company) {
          return reply.status(400).send({
            error: "Contractor company not found",
            code: "INVALID_REFERENCE",
          });
        }
        if (!company.isContractor) {
          return reply.status(400).send({
            error: "Company is not a contractor",
            code: "VALIDATION_ERROR",
          });
        }
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };

      if (input.firstName !== undefined) updateValues.firstName = input.firstName;
      if (input.lastName !== undefined) updateValues.lastName = input.lastName;
      if (input.dateOfBirth !== undefined)
        updateValues.dateOfBirth = input.dateOfBirth;
      if (input.phone !== undefined) updateValues.phone = input.phone;
      if (input.email !== undefined) updateValues.email = input.email;
      if (input.homeAddress !== undefined)
        updateValues.homeAddress = input.homeAddress;
      if (input.position !== undefined) updateValues.position = input.position;
      if (input.employmentType !== undefined)
        updateValues.employmentType = input.employmentType;
      if (input.startDate !== undefined) updateValues.startDate = input.startDate;
      if (input.department !== undefined)
        updateValues.department = input.department;
      if (input.isDriver !== undefined) updateValues.isDriver = input.isDriver;
      if (input.contractorCompanyId !== undefined)
        updateValues.contractorCompanyId = input.contractorCompanyId;
      if (input.emergencyContacts !== undefined)
        updateValues.emergencyContacts = input.emergencyContacts;
      if (input.status !== undefined) updateValues.status = input.status;

      const [updated] = await ctx.tenantDb
        .update(employees)
        .set(updateValues)
        .where(eq(employees.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "employee",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── DELETE (soft) ──

  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid employee ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(employees)
        .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Employee not found", code: "NOT_FOUND" });
      }

      const [deleted] = await ctx.tenantDb
        .update(employees)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(employees.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "employee",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );

  // ── LICENCES (nested under employees) ──

  app.post(
    "/:employeeId/licences",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = employeeIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid employee ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = createLicenceSchema.safeParse({
        ...(request.body as Record<string, unknown>),
        employeeId: paramsParsed.data.employeeId,
      });
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid licence data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;

      // Verify employee exists and is a driver
      const [employee] = await ctx.tenantDb
        .select({ id: employees.id, isDriver: employees.isDriver })
        .from(employees)
        .where(
          and(
            eq(employees.id, input.employeeId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (!employee) {
        return reply
          .status(404)
          .send({ error: "Employee not found", code: "NOT_FOUND" });
      }
      if (!employee.isDriver) {
        return reply.status(400).send({
          error: "Employee is not a driver",
          code: "VALIDATION_ERROR",
        });
      }

      const id = crypto.randomUUID();

      const [licence] = await ctx.tenantDb
        .insert(licences)
        .values({
          id,
          employeeId: input.employeeId,
          licenceClass: input.licenceClass,
          licenceNumber: input.licenceNumber,
          stateOfIssue: input.stateOfIssue,
          expiryDate: input.expiryDate,
          conditions: input.conditions,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "licence",
        entityId: id,
        newData: licence,
      });

      return reply.status(201).send({ success: true, data: licence });
    },
  );

  app.put(
    "/:employeeId/licences/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsSchema = z.object({ employeeId: z.uuid(), id: z.uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateLicenceSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid licence data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { employeeId, id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(licences)
        .where(
          and(eq(licences.id, id), eq(licences.employeeId, employeeId)),
        )
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Licence not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.licenceClass !== undefined)
        updateValues.licenceClass = input.licenceClass;
      if (input.licenceNumber !== undefined)
        updateValues.licenceNumber = input.licenceNumber;
      if (input.stateOfIssue !== undefined)
        updateValues.stateOfIssue = input.stateOfIssue;
      if (input.expiryDate !== undefined)
        updateValues.expiryDate = input.expiryDate;
      if (input.conditions !== undefined)
        updateValues.conditions = input.conditions;

      const [updated] = await ctx.tenantDb
        .update(licences)
        .set(updateValues)
        .where(eq(licences.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "licence",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  app.delete(
    "/:employeeId/licences/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsSchema = z.object({ employeeId: z.uuid(), id: z.uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const { employeeId, id } = paramsParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(licences)
        .where(
          and(eq(licences.id, id), eq(licences.employeeId, employeeId)),
        )
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Licence not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb.delete(licences).where(eq(licences.id, id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "licence",
        entityId: id,
        previousData: existing,
      });

      return { success: true, data: { id } };
    },
  );

  // ── MEDICALS (nested under employees) ──

  app.post(
    "/:employeeId/medicals",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = employeeIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid employee ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = createMedicalSchema.safeParse({
        ...(request.body as Record<string, unknown>),
        employeeId: paramsParsed.data.employeeId,
      });
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid medical data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;

      // Verify employee exists and is a driver
      const [employee] = await ctx.tenantDb
        .select({ id: employees.id, isDriver: employees.isDriver })
        .from(employees)
        .where(
          and(
            eq(employees.id, input.employeeId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (!employee) {
        return reply
          .status(404)
          .send({ error: "Employee not found", code: "NOT_FOUND" });
      }
      if (!employee.isDriver) {
        return reply.status(400).send({
          error: "Employee is not a driver",
          code: "VALIDATION_ERROR",
        });
      }

      const id = crypto.randomUUID();

      const [medical] = await ctx.tenantDb
        .insert(medicals)
        .values({
          id,
          employeeId: input.employeeId,
          certificateNumber: input.certificateNumber,
          issuedDate: input.issuedDate,
          expiryDate: input.expiryDate,
          conditions: input.conditions,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "medical",
        entityId: id,
        newData: medical,
      });

      return reply.status(201).send({ success: true, data: medical });
    },
  );

  app.put(
    "/:employeeId/medicals/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsSchema = z.object({ employeeId: z.uuid(), id: z.uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateMedicalSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid medical data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { employeeId, id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(medicals)
        .where(
          and(eq(medicals.id, id), eq(medicals.employeeId, employeeId)),
        )
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Medical record not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.certificateNumber !== undefined)
        updateValues.certificateNumber = input.certificateNumber;
      if (input.issuedDate !== undefined)
        updateValues.issuedDate = input.issuedDate;
      if (input.expiryDate !== undefined)
        updateValues.expiryDate = input.expiryDate;
      if (input.conditions !== undefined)
        updateValues.conditions = input.conditions;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(medicals)
        .set(updateValues)
        .where(eq(medicals.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "medical",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  app.delete(
    "/:employeeId/medicals/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsSchema = z.object({ employeeId: z.uuid(), id: z.uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const { employeeId, id } = paramsParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(medicals)
        .where(
          and(eq(medicals.id, id), eq(medicals.employeeId, employeeId)),
        )
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Medical record not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb.delete(medicals).where(eq(medicals.id, id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "medical",
        entityId: id,
        previousData: existing,
      });

      return { success: true, data: { id } };
    },
  );

  // ── QUALIFICATIONS (nested under employees) ──

  app.post(
    "/:employeeId/qualifications",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = employeeIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid employee ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = createQualificationSchema.safeParse({
        ...(request.body as Record<string, unknown>),
        employeeId: paramsParsed.data.employeeId,
      });
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid qualification data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;

      // Verify employee exists
      const [employee] = await ctx.tenantDb
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.id, input.employeeId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (!employee) {
        return reply
          .status(404)
          .send({ error: "Employee not found", code: "NOT_FOUND" });
      }

      // Verify qualification type exists
      const [qualType] = await ctx.tenantDb
        .select({ id: qualificationTypes.id })
        .from(qualificationTypes)
        .where(eq(qualificationTypes.id, input.qualificationTypeId))
        .limit(1);

      if (!qualType) {
        return reply.status(400).send({
          error: "Qualification type not found",
          code: "INVALID_REFERENCE",
        });
      }

      const id = crypto.randomUUID();

      const [qualification] = await ctx.tenantDb
        .insert(qualifications)
        .values({
          id,
          employeeId: input.employeeId,
          qualificationTypeId: input.qualificationTypeId,
          referenceNumber: input.referenceNumber,
          stateOfIssue: input.stateOfIssue,
          issuedDate: input.issuedDate,
          expiryDate: input.expiryDate,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "qualification",
        entityId: id,
        newData: qualification,
      });

      return reply.status(201).send({ success: true, data: qualification });
    },
  );

  app.put(
    "/:employeeId/qualifications/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsSchema = z.object({ employeeId: z.uuid(), id: z.uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateQualificationSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid qualification data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { employeeId, id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(qualifications)
        .where(
          and(
            eq(qualifications.id, id),
            eq(qualifications.employeeId, employeeId),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Qualification not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.referenceNumber !== undefined)
        updateValues.referenceNumber = input.referenceNumber;
      if (input.stateOfIssue !== undefined)
        updateValues.stateOfIssue = input.stateOfIssue;
      if (input.issuedDate !== undefined)
        updateValues.issuedDate = input.issuedDate;
      if (input.expiryDate !== undefined)
        updateValues.expiryDate = input.expiryDate;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(qualifications)
        .set(updateValues)
        .where(eq(qualifications.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "qualification",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  app.delete(
    "/:employeeId/qualifications/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsSchema = z.object({ employeeId: z.uuid(), id: z.uuid() });
      const paramsParsed = paramsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply
          .status(400)
          .send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const { employeeId, id } = paramsParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(qualifications)
        .where(
          and(
            eq(qualifications.id, id),
            eq(qualifications.employeeId, employeeId),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send({ error: "Qualification not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .delete(qualifications)
        .where(eq(qualifications.id, id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "qualification",
        entityId: id,
        previousData: existing,
      });

      return { success: true, data: { id } };
    },
  );
}
