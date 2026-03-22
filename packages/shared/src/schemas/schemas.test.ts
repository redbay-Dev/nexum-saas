import { describe, it, expect } from "vitest";
import {
  abnSchema,
  createCompanySchema,
  createEmployeeSchema,
  createJobSchema,
  createJobLocationSchema,
  createJobPricingLineSchema,
  createJobAssignmentSchema,
  createAssetSchema,
  createAddressSchema,
  createContactSchema,
  createTenantMaterialSchema,
  createSupplierMaterialSchema,
  createDisposalMaterialSchema,
  organisationSchema,
  paginationQuerySchema,
  jobStatusTransitionSchema,
  createLicenceSchema,
  createMedicalSchema,
  createCustomerRateCardSchema,
  createRateCardEntrySchema,
  createMarkupRuleSchema,
  createMarginThresholdSchema,
  createSurchargeSchema,
  createPricingTemplateSchema,
  createTemplateLineSchema,
  bulkPriceUpdateSchema,
  createPricingAllocationSchema,
  updateOrganisationSchema,
  createDaysheetSchema,
  createDaysheetLoadSchema,
  daysheetStatusTransitionSchema,
  createDocketSchema,
  createChargeSchema,
  overageDecisionSchema,
  batchProcessDaysheetsSchema,
  reconcileDocketSchema,
} from "./index.js";

// ── ABN Schema ──

describe("abnSchema", () => {
  it("should accept a valid 11-digit ABN", () => {
    expect(abnSchema.safeParse("51824753556").success).toBe(true);
  });

  it("should reject ABN with wrong length", () => {
    expect(abnSchema.safeParse("1234567890").success).toBe(false);
    expect(abnSchema.safeParse("123456789012").success).toBe(false);
  });

  it("should reject ABN with letters", () => {
    expect(abnSchema.safeParse("5182475355a").success).toBe(false);
  });

  it("should reject empty string", () => {
    expect(abnSchema.safeParse("").success).toBe(false);
  });
});

// ── Company Schema ──

describe("createCompanySchema", () => {
  const validCompany = {
    name: "Farrell Transport",
    roles: ["customer"] as const,
  };

  it("should accept valid company with minimal fields", () => {
    const result = createCompanySchema.safeParse(validCompany);
    expect(result.success).toBe(true);
  });

  it("should accept company with all optional fields", () => {
    const result = createCompanySchema.safeParse({
      ...validCompany,
      tradingName: "Farrell's",
      abn: "51824753556",
      phone: "+61412345678",
      email: "info@farrell.com.au",
      website: "https://farrell.com.au",
      status: "active",
      notes: "Good customer",
    });
    expect(result.success).toBe(true);
  });

  it("should reject company without name", () => {
    const result = createCompanySchema.safeParse({ roles: ["customer"] });
    expect(result.success).toBe(false);
  });

  it("should reject company without roles", () => {
    const result = createCompanySchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("should reject empty roles array", () => {
    const result = createCompanySchema.safeParse({
      name: "Test",
      roles: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid role", () => {
    const result = createCompanySchema.safeParse({
      name: "Test",
      roles: ["invalid_role"],
    });
    expect(result.success).toBe(false);
  });

  it("should accept multiple roles", () => {
    const result = createCompanySchema.safeParse({
      name: "Multi-Role Co",
      roles: ["customer", "contractor", "supplier"],
    });
    expect(result.success).toBe(true);
  });

  it("should default status to active", () => {
    const result = createCompanySchema.safeParse(validCompany);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("should reject invalid status", () => {
    const result = createCompanySchema.safeParse({
      ...validCompany,
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });
});

// ── Employee Schema ──

describe("createEmployeeSchema", () => {
  const validEmployee = {
    firstName: "John",
    lastName: "Smith",
    position: "Driver",
    employmentType: "full_time" as const,
    startDate: "2026-01-15",
  };

  it("should accept valid employee", () => {
    const result = createEmployeeSchema.safeParse(validEmployee);
    expect(result.success).toBe(true);
  });

  it("should default isDriver to false", () => {
    const result = createEmployeeSchema.safeParse(validEmployee);
    if (result.success) {
      expect(result.data.isDriver).toBe(false);
    }
  });

  it("should accept driver employee", () => {
    const result = createEmployeeSchema.safeParse({
      ...validEmployee,
      isDriver: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing firstName", () => {
    const { firstName: _firstName, ...rest } = validEmployee;
    expect(createEmployeeSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject invalid employment type", () => {
    const result = createEmployeeSchema.safeParse({
      ...validEmployee,
      employmentType: "freelance",
    });
    expect(result.success).toBe(false);
  });

  it("should accept all valid employment types", () => {
    for (const type of [
      "full_time",
      "part_time",
      "casual",
      "salary",
      "wages",
    ]) {
      const result = createEmployeeSchema.safeParse({
        ...validEmployee,
        employmentType: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should accept emergency contacts", () => {
    const result = createEmployeeSchema.safeParse({
      ...validEmployee,
      emergencyContacts: [
        {
          name: "Jane Smith",
          relationship: "Spouse",
          phone: "+61412345678",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ── Licence Schema ──

describe("createLicenceSchema", () => {
  const validLicence = {
    employeeId: "550e8400-e29b-41d4-a716-446655440000",
    licenceClass: "HC" as const,
    licenceNumber: "12345678",
    stateOfIssue: "QLD" as const,
    expiryDate: "2027-06-30",
  };

  it("should accept valid licence", () => {
    expect(createLicenceSchema.safeParse(validLicence).success).toBe(true);
  });

  it("should accept all Australian licence classes", () => {
    for (const cls of ["C", "LR", "MR", "HR", "HC", "MC"]) {
      const result = createLicenceSchema.safeParse({
        ...validLicence,
        licenceClass: cls,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid licence class", () => {
    const result = createLicenceSchema.safeParse({
      ...validLicence,
      licenceClass: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("should accept all Australian states", () => {
    for (const state of ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"]) {
      const result = createLicenceSchema.safeParse({
        ...validLicence,
        stateOfIssue: state,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ── Medical Schema ──

describe("createMedicalSchema", () => {
  it("should accept valid medical record", () => {
    const result = createMedicalSchema.safeParse({
      employeeId: "550e8400-e29b-41d4-a716-446655440000",
      issuedDate: "2026-01-01",
      expiryDate: "2027-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing issuedDate", () => {
    const result = createMedicalSchema.safeParse({
      employeeId: "550e8400-e29b-41d4-a716-446655440000",
      expiryDate: "2027-01-01",
    });
    expect(result.success).toBe(false);
  });
});

// ── Job Schema ──

describe("createJobSchema", () => {
  const validJob = {
    name: "Deliver sand to Toowoomba",
    jobTypeId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("should accept valid job with minimal fields", () => {
    expect(createJobSchema.safeParse(validJob).success).toBe(true);
  });

  it("should default priority to medium", () => {
    const result = createJobSchema.safeParse(validJob);
    if (result.success) {
      expect(result.data.priority).toBe("medium");
    }
  });

  it("should accept all priority levels", () => {
    for (const priority of ["low", "medium", "high"]) {
      const result = createJobSchema.safeParse({ ...validJob, priority });
      expect(result.success).toBe(true);
    }
  });

  it("should reject missing name", () => {
    const result = createJobSchema.safeParse({
      jobTypeId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing jobTypeId", () => {
    const result = createJobSchema.safeParse({ name: "Test Job" });
    expect(result.success).toBe(false);
  });

  it("should accept job with all optional fields", () => {
    const result = createJobSchema.safeParse({
      ...validJob,
      customerId: "550e8400-e29b-41d4-a716-446655440001",
      projectId: "550e8400-e29b-41d4-a716-446655440002",
      poNumber: "PO-12345",
      priority: "high",
      scheduledStart: "2026-03-25T06:00:00Z",
      scheduledEnd: "2026-03-25T18:00:00Z",
      isMultiDay: false,
      minimumChargeHours: 4,
      externalNotes: "Customer-visible notes",
      internalNotes: "Internal only",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid UUID for customerId", () => {
    const result = createJobSchema.safeParse({
      ...validJob,
      customerId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ── Job Status Transition Schema ──

describe("jobStatusTransitionSchema", () => {
  it("should accept valid status with reason", () => {
    const result = jobStatusTransitionSchema.safeParse({
      status: "cancelled",
      reason: "Customer requested cancellation",
    });
    expect(result.success).toBe(true);
  });

  it("should accept status without reason", () => {
    const result = jobStatusTransitionSchema.safeParse({
      status: "in_progress",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const result = jobStatusTransitionSchema.safeParse({
      status: "invalid_status",
    });
    expect(result.success).toBe(false);
  });
});

// ── Job Location Schema ──

describe("createJobLocationSchema", () => {
  it("should accept pickup location", () => {
    const result = createJobLocationSchema.safeParse({
      locationType: "pickup",
      addressId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("should accept delivery location", () => {
    const result = createJobLocationSchema.safeParse({
      locationType: "delivery",
      addressId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid location type", () => {
    const result = createJobLocationSchema.safeParse({
      locationType: "intermediate",
      addressId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });
});

// ── Job Pricing Line Schema ──

describe("createJobPricingLineSchema", () => {
  const validLine = {
    lineType: "revenue" as const,
    category: "cartage" as const,
    rateType: "per_hour" as const,
  };

  it("should accept valid pricing line", () => {
    expect(createJobPricingLineSchema.safeParse(validLine).success).toBe(true);
  });

  it("should default quantity, unitRate, total to 0", () => {
    const result = createJobPricingLineSchema.safeParse(validLine);
    if (result.success) {
      expect(result.data.quantity).toBe(0);
      expect(result.data.unitRate).toBe(0);
      expect(result.data.total).toBe(0);
    }
  });

  it("should accept all rate types", () => {
    for (const rateType of [
      "per_hour",
      "per_tonne",
      "per_cubic_metre",
      "per_km",
      "per_load",
      "flat",
    ]) {
      const result = createJobPricingLineSchema.safeParse({
        ...validLine,
        rateType,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should accept all pricing categories", () => {
    for (const category of [
      "hire",
      "cartage",
      "tip_fee",
      "material",
      "subcontractor",
      "fuel_levy",
      "other",
    ]) {
      const result = createJobPricingLineSchema.safeParse({
        ...validLine,
        category,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should allow negative quantity for credits", () => {
    const result = createJobPricingLineSchema.safeParse({
      ...validLine,
      quantity: -1,
      creditType: "rate_correction",
    });
    expect(result.success).toBe(true);
  });

  it("should allow negative total for credit lines", () => {
    const result = createJobPricingLineSchema.safeParse({
      ...validLine,
      total: -500,
      unitRate: -25,
      quantity: 20,
      creditType: "goodwill",
      originalLineId: "11111111-1111-4111-a111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("should accept tracing fields", () => {
    const result = createJobPricingLineSchema.safeParse({
      ...validLine,
      usedCustomerPricing: true,
      rateCardEntryId: "11111111-1111-4111-a111-111111111111",
      markupRuleId: "22222222-2222-4222-a222-222222222222",
      surchargeId: "33333333-3333-4333-a333-333333333333",
      marginOverrideReason: "Approved by manager — volume discount",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid credit type", () => {
    const result = createJobPricingLineSchema.safeParse({
      ...validLine,
      creditType: "invalid_type",
    });
    expect(result.success).toBe(false);
  });
});

// ── Job Assignment Schema ──

describe("createJobAssignmentSchema", () => {
  it("should accept asset assignment", () => {
    const result = createJobAssignmentSchema.safeParse({
      assignmentType: "asset",
      assetId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("should accept driver assignment", () => {
    const result = createJobAssignmentSchema.safeParse({
      assignmentType: "driver",
      employeeId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("should accept contractor assignment", () => {
    const result = createJobAssignmentSchema.safeParse({
      assignmentType: "contractor",
      contractorCompanyId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("should accept assignment with planned times", () => {
    const result = createJobAssignmentSchema.safeParse({
      assignmentType: "driver",
      employeeId: "550e8400-e29b-41d4-a716-446655440000",
      plannedStart: "2026-03-25T06:00:00Z",
      plannedEnd: "2026-03-25T18:00:00Z",
      notes: "Arrive early",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid assignment type", () => {
    const result = createJobAssignmentSchema.safeParse({
      assignmentType: "subcontractor",
    });
    expect(result.success).toBe(false);
  });
});

// ── Address Schema ──

describe("createAddressSchema", () => {
  const validAddress = {
    streetAddress: "123 Main St",
    suburb: "Brisbane",
    state: "QLD" as const,
    postcode: "4000",
    types: ["office"] as const,
  };

  it("should accept valid address", () => {
    expect(createAddressSchema.safeParse(validAddress).success).toBe(true);
  });

  it("should reject invalid postcode (not 4 digits)", () => {
    expect(
      createAddressSchema.safeParse({ ...validAddress, postcode: "40000" })
        .success,
    ).toBe(false);
    expect(
      createAddressSchema.safeParse({ ...validAddress, postcode: "ABC1" })
        .success,
    ).toBe(false);
  });

  it("should reject invalid state", () => {
    expect(
      createAddressSchema.safeParse({ ...validAddress, state: "CAL" }).success,
    ).toBe(false);
  });

  it("should reject empty types array", () => {
    expect(
      createAddressSchema.safeParse({ ...validAddress, types: [] }).success,
    ).toBe(false);
  });

  it("should accept coordinates", () => {
    const result = createAddressSchema.safeParse({
      ...validAddress,
      latitude: -27.4705,
      longitude: 153.026,
    });
    expect(result.success).toBe(true);
  });

  it("should reject out-of-range latitude", () => {
    expect(
      createAddressSchema.safeParse({ ...validAddress, latitude: -91 }).success,
    ).toBe(false);
    expect(
      createAddressSchema.safeParse({ ...validAddress, latitude: 91 }).success,
    ).toBe(false);
  });
});

// ── Contact Schema ──

describe("createContactSchema", () => {
  it("should accept valid contact", () => {
    const result = createContactSchema.safeParse({
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(result.success).toBe(true);
  });

  it("should default preferred contact method to email", () => {
    const result = createContactSchema.safeParse({
      firstName: "Jane",
      lastName: "Doe",
    });
    if (result.success) {
      expect(result.data.preferredContactMethod).toBe("email");
    }
  });

  it("should default smsOptIn to false", () => {
    const result = createContactSchema.safeParse({
      firstName: "Jane",
      lastName: "Doe",
    });
    if (result.success) {
      expect(result.data.smsOptIn).toBe(false);
    }
  });
});

// ── Asset Schema ──

describe("createAssetSchema", () => {
  const validAsset = {
    categoryId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("should accept valid asset with minimal fields", () => {
    expect(createAssetSchema.safeParse(validAsset).success).toBe(true);
  });

  it("should default status to available", () => {
    const result = createAssetSchema.safeParse(validAsset);
    if (result.success) {
      expect(result.data.status).toBe("available");
    }
  });

  it("should default ownership to tenant", () => {
    const result = createAssetSchema.safeParse(validAsset);
    if (result.success) {
      expect(result.data.ownership).toBe("tenant");
    }
  });

  it("should accept full asset record", () => {
    const result = createAssetSchema.safeParse({
      ...validAsset,
      assetNumber: "T001",
      registrationNumber: "123ABC",
      registrationState: "QLD",
      make: "Kenworth",
      model: "T610",
      year: 2024,
      vin: "1HGBH41JXMN109186",
      tareWeight: 8500,
      gvm: 22500,
      gcm: 42500,
      equipmentFitted: {
        scales: true,
        gpsTracking: true,
        uhfRadio: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject year out of range", () => {
    expect(
      createAssetSchema.safeParse({ ...validAsset, year: 1800 }).success,
    ).toBe(false);
    expect(
      createAssetSchema.safeParse({ ...validAsset, year: 2200 }).success,
    ).toBe(false);
  });

  it("should reject negative weight values", () => {
    expect(
      createAssetSchema.safeParse({ ...validAsset, tareWeight: -100 }).success,
    ).toBe(false);
  });
});

// ── Material Schemas ──

describe("createTenantMaterialSchema", () => {
  it("should accept valid tenant material", () => {
    const result = createTenantMaterialSchema.safeParse({
      name: "Clean Fill",
      unitOfMeasure: "tonne",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all units of measure", () => {
    for (const uom of ["tonne", "cubic_metre", "load", "hour", "kilometre"]) {
      const result = createTenantMaterialSchema.safeParse({
        name: "Test",
        unitOfMeasure: uom,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should accept material with compliance flags", () => {
    const result = createTenantMaterialSchema.safeParse({
      name: "Contaminated Soil",
      unitOfMeasure: "tonne",
      compliance: {
        isHazardous: true,
        isRegulatedWaste: true,
        requiresTracking: true,
        wasteCode: "J100",
        epaCategory: "Category A",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("createSupplierMaterialSchema", () => {
  it("should require supplierId and supplierName", () => {
    const result = createSupplierMaterialSchema.safeParse({
      name: "River Sand",
      unitOfMeasure: "tonne",
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid supplier material with pricing", () => {
    const result = createSupplierMaterialSchema.safeParse({
      supplierId: "550e8400-e29b-41d4-a716-446655440000",
      supplierName: "Sand Supplies Pty Ltd",
      name: "River Sand",
      unitOfMeasure: "tonne",
      purchasePrice: 45.5,
      minimumOrderQty: 20,
    });
    expect(result.success).toBe(true);
  });
});

describe("createDisposalMaterialSchema", () => {
  it("should require addressId and materialMode", () => {
    const result = createDisposalMaterialSchema.safeParse({
      name: "Clean Fill",
      unitOfMeasure: "tonne",
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid disposal material with fees", () => {
    const result = createDisposalMaterialSchema.safeParse({
      addressId: "550e8400-e29b-41d4-a716-446655440000",
      name: "General Waste",
      unitOfMeasure: "tonne",
      materialMode: "disposal",
      tipFee: 85.0,
      environmentalLevy: 15.0,
      minimumCharge: 50.0,
    });
    expect(result.success).toBe(true);
  });

  it("should accept supply mode", () => {
    const result = createDisposalMaterialSchema.safeParse({
      addressId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Recycled Aggregate",
      unitOfMeasure: "tonne",
      materialMode: "supply",
      salePrice: 30.0,
    });
    expect(result.success).toBe(true);
  });
});

// ── Organisation Schema ──

describe("organisationSchema", () => {
  it("should accept valid organisation", () => {
    const result = organisationSchema.safeParse({
      companyName: "Farrell Transport Pty Ltd",
      abn: "51824753556",
    });
    expect(result.success).toBe(true);
  });

  it("should default timezone to Australia/Brisbane", () => {
    const result = organisationSchema.safeParse({
      companyName: "Test",
      abn: "51824753556",
    });
    if (result.success) {
      expect(result.data.timezone).toBe("Australia/Brisbane");
    }
  });

  it("should default payment terms to 30 days", () => {
    const result = organisationSchema.safeParse({
      companyName: "Test",
      abn: "51824753556",
    });
    if (result.success) {
      expect(result.data.defaultPaymentTerms).toBe(30);
    }
  });

  it("should validate BSB format (6 digits)", () => {
    const result = organisationSchema.safeParse({
      companyName: "Test",
      abn: "51824753556",
      bankBsb: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("should reject payment terms > 365", () => {
    const result = organisationSchema.safeParse({
      companyName: "Test",
      abn: "51824753556",
      defaultPaymentTerms: 400,
    });
    expect(result.success).toBe(false);
  });
});

// ── Pagination Schema ──

describe("paginationQuerySchema", () => {
  it("should default limit to 50", () => {
    const result = paginationQuerySchema.safeParse({});
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("should reject limit > 100", () => {
    expect(paginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("should reject limit < 1", () => {
    expect(paginationQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it("should coerce string limit to number", () => {
    const result = paginationQuerySchema.safeParse({ limit: "25" });
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// ── Pricing Engine Schemas ──
// ══════════════════════════════════════════════════════════════════

describe("createCustomerRateCardSchema", () => {
  it("should accept valid rate card", () => {
    const result = createCustomerRateCardSchema.safeParse({
      customerId: "11111111-1111-4111-a111-111111111111",
      name: "Standard Rates 2026",
      effectiveFrom: "2026-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("should accept rate card with all fields", () => {
    const result = createCustomerRateCardSchema.safeParse({
      customerId: "11111111-1111-4111-a111-111111111111",
      name: "Premium Rates Q1",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-03-31",
      isActive: true,
      notes: "Negotiated annual review",
    });
    expect(result.success).toBe(true);
  });

  it("should reject rate card without customer", () => {
    expect(createCustomerRateCardSchema.safeParse({
      name: "No Customer",
      effectiveFrom: "2026-01-01",
    }).success).toBe(false);
  });

  it("should reject rate card without name", () => {
    expect(createCustomerRateCardSchema.safeParse({
      customerId: "11111111-1111-4111-a111-111111111111",
      effectiveFrom: "2026-01-01",
    }).success).toBe(false);
  });
});

describe("createRateCardEntrySchema", () => {
  it("should accept valid entry", () => {
    const result = createRateCardEntrySchema.safeParse({
      category: "cartage",
      rateType: "per_tonne",
      unitRate: 15.50,
    });
    expect(result.success).toBe(true);
  });

  it("should accept entry with material subcategory", () => {
    const result = createRateCardEntrySchema.safeParse({
      materialSubcategoryId: "22222222-2222-4222-a222-222222222222",
      category: "material",
      rateType: "per_tonne",
      unitRate: 30,
      description: "Clean fill delivery",
    });
    expect(result.success).toBe(true);
  });

  it("should reject entry without category", () => {
    expect(createRateCardEntrySchema.safeParse({
      rateType: "per_tonne",
      unitRate: 10,
    }).success).toBe(false);
  });
});

describe("createMarkupRuleSchema", () => {
  it("should accept percentage rule", () => {
    const result = createMarkupRuleSchema.safeParse({
      name: "Standard 20% Markup",
      type: "percentage",
      markupPercentage: 20,
      priority: 10,
    });
    expect(result.success).toBe(true);
  });

  it("should accept fixed amount rule", () => {
    const result = createMarkupRuleSchema.safeParse({
      name: "$5/t Clean Fill",
      type: "fixed",
      markupFixedAmount: 5,
      materialCategoryId: "11111111-1111-4111-a111-111111111111",
      supplierId: "22222222-2222-4222-a222-222222222222",
      priority: 5,
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid type", () => {
    expect(createMarkupRuleSchema.safeParse({
      name: "Bad",
      type: "invalid",
      markupPercentage: 10,
    }).success).toBe(false);
  });

  it("should default priority to 100", () => {
    const result = createMarkupRuleSchema.safeParse({
      name: "Default Priority",
      type: "percentage",
      markupPercentage: 15,
    });
    if (result.success) {
      expect(result.data.priority).toBe(100);
    }
  });
});

describe("createMarginThresholdSchema", () => {
  it("should accept global threshold", () => {
    const result = createMarginThresholdSchema.safeParse({
      level: "global",
      minimumMarginPercent: 10,
      warningMarginPercent: 15,
    });
    expect(result.success).toBe(true);
  });

  it("should accept customer-level threshold with reference", () => {
    const result = createMarginThresholdSchema.safeParse({
      level: "customer",
      referenceId: "11111111-1111-4111-a111-111111111111",
      minimumMarginPercent: 5,
      warningMarginPercent: 8,
      requiresApproval: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid level", () => {
    expect(createMarginThresholdSchema.safeParse({
      level: "invalid",
      minimumMarginPercent: 10,
      warningMarginPercent: 15,
    }).success).toBe(false);
  });

  it("should accept all four levels", () => {
    for (const level of ["global", "category", "customer", "material_type"]) {
      expect(createMarginThresholdSchema.safeParse({
        level,
        minimumMarginPercent: 10,
        warningMarginPercent: 15,
      }).success).toBe(true);
    }
  });
});

describe("createSurchargeSchema", () => {
  it("should accept percentage surcharge", () => {
    const result = createSurchargeSchema.safeParse({
      name: "Fuel Levy",
      type: "percentage",
      value: 3.5,
      appliesTo: ["cartage", "hire"],
      effectiveFrom: "2026-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("should accept fixed surcharge", () => {
    const result = createSurchargeSchema.safeParse({
      name: "Environmental Surcharge",
      type: "fixed",
      value: 2.50,
      appliesTo: ["tip_fee"],
      autoApply: false,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2026-06-30",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty appliesTo", () => {
    expect(createSurchargeSchema.safeParse({
      name: "No Categories",
      type: "percentage",
      value: 5,
      appliesTo: [],
      effectiveFrom: "2026-01-01",
    }).success).toBe(false);
  });
});

describe("createPricingTemplateSchema", () => {
  it("should accept valid template", () => {
    const result = createPricingTemplateSchema.safeParse({
      name: "Standard Quarry Run",
      description: "Default pricing for quarry deliveries",
    });
    expect(result.success).toBe(true);
  });
});

describe("createTemplateLineSchema", () => {
  it("should accept valid template line", () => {
    const result = createTemplateLineSchema.safeParse({
      lineType: "revenue",
      category: "cartage",
      rateType: "per_tonne",
      unitRate: 15,
      description: "Standard cartage rate",
    });
    expect(result.success).toBe(true);
  });

  it("should accept line without unit rate", () => {
    const result = createTemplateLineSchema.safeParse({
      lineType: "cost",
      category: "material",
      rateType: "per_tonne",
    });
    expect(result.success).toBe(true);
  });
});

describe("bulkPriceUpdateSchema", () => {
  it("should accept valid bulk update", () => {
    const result = bulkPriceUpdateSchema.safeParse({
      materialIds: ["11111111-1111-4111-a111-111111111111"],
      percentage: 5,
      effectiveDate: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("should accept negative percentage (decrease)", () => {
    const result = bulkPriceUpdateSchema.safeParse({
      materialIds: ["11111111-1111-4111-a111-111111111111"],
      percentage: -10,
      effectiveDate: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty materialIds", () => {
    expect(bulkPriceUpdateSchema.safeParse({
      materialIds: [],
      percentage: 5,
      effectiveDate: "2026-04-01",
    }).success).toBe(false);
  });
});

describe("createPricingAllocationSchema", () => {
  it("should accept valid allocation", () => {
    const result = createPricingAllocationSchema.safeParse({
      customerId: "11111111-1111-4111-a111-111111111111",
      amount: 500,
      percentage: 50,
    });
    expect(result.success).toBe(true);
  });

  it("should reject percentage over 100", () => {
    expect(createPricingAllocationSchema.safeParse({
      customerId: "11111111-1111-4111-a111-111111111111",
      amount: 500,
      percentage: 101,
    }).success).toBe(false);
  });

  it("should reject negative percentage", () => {
    expect(createPricingAllocationSchema.safeParse({
      customerId: "11111111-1111-4111-a111-111111111111",
      amount: 500,
      percentage: -5,
    }).success).toBe(false);
  });
});

describe("updateOrganisationSchema pricing fields", () => {
  it("should accept quotePricingMode", () => {
    const result = updateOrganisationSchema.safeParse({
      quotePricingMode: "lock_at_quote",
    });
    expect(result.success).toBe(true);
  });

  it("should accept update_on_acceptance mode", () => {
    const result = updateOrganisationSchema.safeParse({
      quotePricingMode: "update_on_acceptance",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid quote pricing mode", () => {
    expect(updateOrganisationSchema.safeParse({
      quotePricingMode: "invalid",
    }).success).toBe(false);
  });

  it("should accept staleRateThresholdDays", () => {
    const result = updateOrganisationSchema.safeParse({
      staleRateThresholdDays: 90,
    });
    expect(result.success).toBe(true);
  });

  it("should reject staleRateThresholdDays < 1", () => {
    expect(updateOrganisationSchema.safeParse({
      staleRateThresholdDays: 0,
    }).success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// ── Daysheet & Docket Schemas (doc 08) ──
// ══════════════════════════════════════════════════════════════════

describe("createDaysheetSchema", () => {
  it("should validate a valid daysheet", () => {
    const result = createDaysheetSchema.safeParse({
      jobId: "550e8400-e29b-41d4-a716-446655440000",
      workDate: "2026-03-22",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.submissionChannel).toBe("staff_entry");
    }
  });

  it("should reject without jobId", () => {
    expect(createDaysheetSchema.safeParse({ workDate: "2026-03-22" }).success).toBe(false);
  });

  it("should reject without workDate", () => {
    expect(createDaysheetSchema.safeParse({ jobId: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(false);
  });

  it("should accept all submission channels", () => {
    for (const channel of ["driverx", "portal", "staff_entry", "auto_generated"] as const) {
      const result = createDaysheetSchema.safeParse({
        jobId: "550e8400-e29b-41d4-a716-446655440000",
        workDate: "2026-03-22",
        submissionChannel: channel,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should accept optional time fields", () => {
    const result = createDaysheetSchema.safeParse({
      jobId: "550e8400-e29b-41d4-a716-446655440000",
      workDate: "2026-03-22",
      startTime: "06:00",
      endTime: "14:30",
      breakMinutes: 30,
      overtimeHours: 2,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative breakMinutes", () => {
    expect(createDaysheetSchema.safeParse({
      jobId: "550e8400-e29b-41d4-a716-446655440000",
      workDate: "2026-03-22",
      breakMinutes: -10,
    }).success).toBe(false);
  });
});

describe("createDaysheetLoadSchema", () => {
  it("should validate a valid load", () => {
    const result = createDaysheetLoadSchema.safeParse({
      loadNumber: 1,
      materialName: "Fill Sand",
      grossWeight: 45.5,
      tareWeight: 22.0,
      quantity: 23.5,
    });
    expect(result.success).toBe(true);
  });

  it("should reject loadNumber < 1", () => {
    expect(createDaysheetLoadSchema.safeParse({ loadNumber: 0 }).success).toBe(false);
  });

  it("should reject negative weights", () => {
    expect(createDaysheetLoadSchema.safeParse({
      loadNumber: 1,
      grossWeight: -5,
    }).success).toBe(false);
  });
});

describe("daysheetStatusTransitionSchema", () => {
  it("should accept valid statuses", () => {
    for (const status of ["submitted", "review", "reconciled", "processed", "rejected"] as const) {
      expect(daysheetStatusTransitionSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("should reject invalid status", () => {
    expect(daysheetStatusTransitionSchema.safeParse({ status: "invalid" }).success).toBe(false);
  });
});

describe("createDocketSchema", () => {
  it("should validate a valid docket", () => {
    const result = createDocketSchema.safeParse({
      jobId: "550e8400-e29b-41d4-a716-446655440000",
      docketType: "weighbridge_ticket",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all docket types", () => {
    for (const type of ["weighbridge_ticket", "tip_receipt", "delivery_receipt", "collection_receipt"] as const) {
      const result = createDocketSchema.safeParse({
        jobId: "550e8400-e29b-41d4-a716-446655440000",
        docketType: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should accept AI confidence scores", () => {
    const result = createDocketSchema.safeParse({
      jobId: "550e8400-e29b-41d4-a716-446655440000",
      docketType: "weighbridge_ticket",
      aiConfidence: { grossWeight: 95, tareWeight: 90, netWeight: 85 },
    });
    expect(result.success).toBe(true);
  });

  it("should reject AI confidence above 100", () => {
    expect(createDocketSchema.safeParse({
      jobId: "550e8400-e29b-41d4-a716-446655440000",
      docketType: "weighbridge_ticket",
      aiConfidence: { grossWeight: 150 },
    }).success).toBe(false);
  });
});

describe("createChargeSchema", () => {
  it("should validate a valid charge", () => {
    const result = createChargeSchema.safeParse({
      daysheetId: "550e8400-e29b-41d4-a716-446655440000",
      jobId: "550e8400-e29b-41d4-a716-446655440001",
      lineType: "revenue",
      category: "cartage",
      rateType: "per_tonne",
    });
    expect(result.success).toBe(true);
  });
});

describe("overageDecisionSchema", () => {
  it("should accept approved with notes", () => {
    const result = overageDecisionSchema.safeParse({
      approvalStatus: "approved",
      approvalNotes: "Within acceptable tolerance",
    });
    expect(result.success).toBe(true);
  });

  it("should accept rejected", () => {
    expect(overageDecisionSchema.safeParse({ approvalStatus: "rejected" }).success).toBe(true);
  });

  it("should reject invalid status", () => {
    expect(overageDecisionSchema.safeParse({ approvalStatus: "pending" }).success).toBe(false);
  });
});

describe("batchProcessDaysheetsSchema", () => {
  it("should accept array of daysheet IDs", () => {
    const result = batchProcessDaysheetsSchema.safeParse({
      daysheetIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty array", () => {
    expect(batchProcessDaysheetsSchema.safeParse({ daysheetIds: [] }).success).toBe(false);
  });

  it("should reject more than 100 IDs", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, "0")}`);
    expect(batchProcessDaysheetsSchema.safeParse({ daysheetIds: ids }).success).toBe(false);
  });
});

describe("reconcileDocketSchema", () => {
  it("should accept valid UUIDs", () => {
    const result = reconcileDocketSchema.safeParse({
      docketId: "550e8400-e29b-41d4-a716-446655440000",
      daysheetId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing fields", () => {
    expect(reconcileDocketSchema.safeParse({ docketId: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(false);
  });
});
