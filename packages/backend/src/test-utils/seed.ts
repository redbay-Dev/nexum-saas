/**
 * Test seed data with fixed UUIDs for deterministic references.
 * Used by global-setup.ts to populate the test tenant schema.
 *
 * All UUIDs must be valid v4 format (version=4 at pos 13, variant=8-b at pos 17)
 * because Zod 4's z.uuid() validates the version/variant bits.
 */

export const TEST_IDS = {
  // Tenant ID is only used in public schema (not Zod-validated), format doesn't matter
  tenant: "11111111-1111-4111-a111-111111111111",
  schemaName: "tenant_11111111-1111-4111-a111-111111111111",
  users: {
    owner: "test-user-owner",
    dispatcher: "test-user-dispatcher",
    finance: "test-user-finance",
    readOnly: "test-user-readonly",
  },
  // All below must be valid v4 UUIDs
  jobType: {
    cartage: "a0a0a0a0-a0a0-4a0a-a0a0-a0a0a0a0a0a0",
    hire: "a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1",
  },
  company: {
    customerA: "b0b0b0b0-b0b0-4b0b-b0b0-b0b0b0b0b0b0",
    contractorA: "b1b1b1b1-b1b1-4b1b-b1b1-b1b1b1b1b1b1",
    supplierA: "b2b2b2b2-b2b2-4b2b-b2b2-b2b2b2b2b2b2",
  },
  employee: {
    driverActive: "c0c0c0c0-c0c0-4c0c-a0c0-c0c0c0c0c0c0",
    driverActive2: "c1c1c1c1-c1c1-4c1c-a1c1-c1c1c1c1c1c1",
    driverTerminated: "c2c2c2c2-c2c2-4c2c-a2c2-c2c2c2c2c2c2",
    nonDriver: "c3c3c3c3-c3c3-4c3c-a3c3-c3c3c3c3c3c3",
  },
  assetCategory: {
    truck: "d0d0d0d0-d0d0-4d0d-a0d0-d0d0d0d0d0d0",
    trailer: "d1d1d1d1-d1d1-4d1d-a1d1-d1d1d1d1d1d1",
  },
  asset: {
    truckAvailable: "e0e0e0e0-e0e0-4e0e-a0e0-e0e0e0e0e0e0",
    truckInUse: "e1e1e1e1-e1e1-4e1e-a1e1-e1e1e1e1e1e1",
    truckMaintenance: "e2e2e2e2-e2e2-4e2e-a2e2-e2e2e2e2e2e2",
  },
  address: {
    quarry: "f0f0f0f0-f0f0-4f0f-a0f0-f0f0f0f0f0f0",
    site: "f1f1f1f1-f1f1-4f1f-a1f1-f1f1f1f1f1f1",
  },
  project: {
    active: "20202020-2020-4202-a020-202020202020",
  },
} as const;

/**
 * SQL statements to seed the test tenant schema.
 * Uses ON CONFLICT DO NOTHING for idempotent re-runs.
 */
export function getTenantSeedSQL(): string[] {
  return [
    // Organisation
    `INSERT INTO organisation (id, company_name, trading_name, abn, timezone)
     VALUES (gen_random_uuid(), 'Test Transport Co', 'Test Transport', '51824753556', 'Australia/Brisbane')
     ON CONFLICT DO NOTHING`,

    // Job types
    `INSERT INTO job_types (id, name, code, is_system, is_active, sort_order, visible_sections, required_fields, defaults)
     VALUES
       ('${TEST_IDS.jobType.cartage}', 'Cartage', 'CART', true, true, 0,
        '{"locations":true,"materials":true,"assetRequirements":true,"pricing":true,"scheduling":true}',
        '{"poNumber":false,"materials":false,"locations":false}',
        '{"priority":"medium"}'),
       ('${TEST_IDS.jobType.hire}', 'Hire', 'HIRE', true, true, 1,
        '{"locations":true,"materials":false,"assetRequirements":true,"pricing":true,"scheduling":true}',
        '{"poNumber":false,"materials":false,"locations":false}',
        '{"priority":"medium"}')
     ON CONFLICT DO NOTHING`,

    // Companies
    `INSERT INTO companies (id, name, is_customer, is_contractor, is_supplier, status)
     VALUES
       ('${TEST_IDS.company.customerA}', 'Alpha Constructions', true, false, false, 'active'),
       ('${TEST_IDS.company.contractorA}', 'Beta Haulage', false, true, false, 'active'),
       ('${TEST_IDS.company.supplierA}', 'Gamma Quarries', false, false, true, 'active')
     ON CONFLICT DO NOTHING`,

    // Employees
    `INSERT INTO employees (id, first_name, last_name, position, employment_type, start_date, is_driver, status)
     VALUES
       ('${TEST_IDS.employee.driverActive}', 'Dave', 'Johnson', 'Driver', 'full_time', '2024-01-01', true, 'active'),
       ('${TEST_IDS.employee.driverActive2}', 'Steve', 'Williams', 'Driver', 'full_time', '2024-03-01', true, 'active'),
       ('${TEST_IDS.employee.driverTerminated}', 'Tom', 'Brown', 'Driver', 'casual', '2023-06-01', true, 'terminated'),
       ('${TEST_IDS.employee.nonDriver}', 'Sarah', 'Miller', 'Dispatcher', 'full_time', '2024-02-01', false, 'active')
     ON CONFLICT DO NOTHING`,

    // Asset categories
    `INSERT INTO asset_categories (id, name, type, industry_type, is_active, sort_order)
     VALUES
       ('${TEST_IDS.assetCategory.truck}', 'Truck', 'truck', 'transport', true, 0),
       ('${TEST_IDS.assetCategory.trailer}', 'Trailer', 'trailer', 'transport', true, 1)
     ON CONFLICT DO NOTHING`,

    // Assets
    `INSERT INTO assets (id, category_id, asset_number, registration_number, make, model, status, ownership)
     VALUES
       ('${TEST_IDS.asset.truckAvailable}', '${TEST_IDS.assetCategory.truck}', 'T001', '123ABC', 'Kenworth', 'T610', 'available', 'tenant'),
       ('${TEST_IDS.asset.truckInUse}', '${TEST_IDS.assetCategory.truck}', 'T002', '456DEF', 'Mack', 'Anthem', 'in_use', 'tenant'),
       ('${TEST_IDS.asset.truckMaintenance}', '${TEST_IDS.assetCategory.truck}', 'T003', '789GHI', 'Volvo', 'FH16', 'maintenance', 'tenant')
     ON CONFLICT DO NOTHING`,

    // Addresses
    `INSERT INTO addresses (id, street_address, suburb, state, postcode, types)
     VALUES
       ('${TEST_IDS.address.quarry}', '100 Quarry Rd', 'Mount Cotton', 'QLD', '4165', '["quarry"]'),
       ('${TEST_IDS.address.site}', '50 Construction Ave', 'Toowoomba', 'QLD', '4350', '["job_site"]')
     ON CONFLICT DO NOTHING`,

    // Project
    `INSERT INTO projects (id, project_number, name, customer_id, status)
     VALUES ('${TEST_IDS.project.active}', 'P-0001', 'Toowoomba Bypass', '${TEST_IDS.company.customerA}', 'active')
     ON CONFLICT DO NOTHING`,
  ];
}
