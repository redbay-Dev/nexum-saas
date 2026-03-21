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

  it("should reject negative quantity", () => {
    const result = createJobPricingLineSchema.safeParse({
      ...validLine,
      quantity: -1,
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
