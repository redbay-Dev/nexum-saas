# SafeSpec ↔ Nexum Integration Note

> **For SafeSpec developers/agents:** This document describes how SafeSpec (compliance & WHS) integrates with Nexum (transport/logistics operations). SafeSpec is the compliance authority — it has all the data. Nexum is an operations platform that benefits from SafeSpec's compliance data when a tenant subscribes to both.
>
> **Copy this into SafeSpec's `docs/integrations/NEXUM.md`.**

---

## The Relationship

SafeSpec and Nexum are separate multi-tenant SaaS products built by the same team, sharing the same monorepo architecture (pnpm + Turborepo), auth system (Better Auth), and some shared packages.

**SafeSpec** is a dedicated compliance and WHS management system. It manages NHVAS, WHS, mass, fatigue, maintenance, defects, pre-starts, drug testing, CoR, document tracking, auditing, and NHVR integration. SafeSpec is the source of truth for all compliance data.

**Nexum** is a transport/logistics operations platform. It manages jobs, scheduling, drivers, assets, contractors, pricing, invoicing, dockets, and a mobile app (DriverX). Nexum does NOT manage compliance — it has no internal compliance engine.

**The integration is optional.** Not all Nexum tenants subscribe to SafeSpec. Nexum works fully without it. When a tenant has both, the two systems talk — SafeSpec provides compliance data, Nexum provides operational data.

---

## What Nexum Is

A multi-tenant web SaaS for Australian heavy transport and logistics:

- **Jobs** — Work orders with customers, locations, materials, scheduling, and pricing
- **Scheduling** — Allocating drivers and assets to jobs (1–300 allocations per job). This is where compliance status matters most — dispatchers need to know what's available.
- **Drivers** — Employee and contractor drivers who operate vehicles
- **Assets** — Trucks, trailers, and equipment with categories/subcategories
- **Contractors** — Subcontractor companies providing drivers and/or assets
- **Daysheets** — Driver work records capturing hours, loads, distances, weights
- **Dockets** — External documents (weighbridge tickets, tip receipts) with AI OCR
- **Pricing & Invoicing** — Revenue/cost lines, customer invoices, contractor RCTIs
- **DriverX** — React Native mobile app for drivers (pre-starts, daysheets, navigation)

---

## What Nexum Needs from SafeSpec

### 1. Compliance Status Check (Highest Priority)

The core interaction. Nexum asks: "Is this entity compliant?"

**Single entity:**
```
GET /compliance/status/{entityType}/{entityId}
```

**Batch (critical — scheduler shows 50–300+ resources):**
```
GET /compliance/status/batch
Body: { entities: [{ type: "driver", id: "uuid" }, { type: "asset", id: "uuid" }, ...] }
```

**Response:**
```json
{
  "entityType": "driver",
  "entityId": "uuid",
  "status": "compliant | non_compliant | warning",
  "summary": "All documents current. Licence expires in 12 days.",
  "blockers": [],
  "warnings": [
    { "type": "licence_expiry", "message": "Licence expires 2026-03-31", "severity": "low" }
  ]
}
```

**Performance:** <200ms single, <500ms for 300 entities. Called during active dispatching — slow responses block operations.

**How Nexum uses it:**
- **Green badge** (compliant) — entity available for allocation
- **Amber badge** (warning) — entity available but flagged, lower recommendation score
- **Red badge** (non-compliant) — entity blocked from allocation, shown as unavailable with reason

### 2. Summary Data (For Display)

Nexum shows compliance summary on entity profiles without needing the full record:

```
GET /compliance/summary/{entityType}/{entityId}
```

**Driver response:** Licence class, expiry, medical status, fatigue hours remaining, qualifications
**Asset response:** Registration status/expiry, next service due, open defect count, mass scheme
**Contractor response:** Insurance status/expiry, NHVAS accreditation, agreement expiry, onboarding %

Nexum caches this. Users click through to SafeSpec for full compliance detail and management.

### 3. Webhook Notifications

When compliance status changes, SafeSpec pushes to Nexum so cached data is invalidated:

**Events:**
- `compliance.status.changed` — Entity status changed (compliant → non_compliant, etc.)
- `compliance.alert.created` — Entity approaching non-compliance

**Payload:**
```json
{
  "event": "compliance.status.changed",
  "entityType": "asset",
  "entityId": "uuid",
  "tenantId": "uuid",
  "previousStatus": "compliant",
  "newStatus": "non_compliant",
  "summary": "Registration expired 2026-03-18",
  "blockers": [{ "type": "registration_expired", "message": "..." }],
  "timestamp": "2026-03-19T10:30:00Z"
}
```

**Security:** HMAC-SHA256 signed.

**Why it matters:** Nexum caches compliance status (15-min TTL). Without webhooks, a non-compliant entity could appear compliant for up to 15 minutes. Webhooks make it near-instant.

### 4. Pre-Start Checklist Definitions

DriverX (Nexum's mobile app) renders pre-start checklists. It needs the definition from SafeSpec:

```
GET /compliance/prestart/checklist/{assetType}
```

**Response:**
```json
{
  "assetType": "rigid_tipper",
  "items": [
    { "id": "uuid", "description": "Check tyre condition and pressure", "checkType": "pass_fail", "severityIfFailed": "major" },
    { "id": "uuid", "description": "Odometer reading", "checkType": "measurement", "unit": "km", "severityIfFailed": null }
  ]
}
```

Cached with long TTL (24h+). SafeSpec can send a webhook if definitions change.

### 5. Pre-Start Submission Processing

DriverX captures pre-starts, Nexum forwards to SafeSpec for processing:

```
POST /compliance/prestart
Body: {
  "assetId": "uuid",
  "driverId": "uuid",
  "tenantId": "uuid",
  "checklistId": "uuid",
  "submittedAt": "2026-03-19T06:00:00Z",
  "results": [
    { "itemId": "uuid", "passed": true },
    { "itemId": "uuid", "passed": false, "notes": "Crack in windscreen", "photo": "base64..." },
    { "itemId": "uuid", "value": "145230", "unit": "km" }
  ]
}
```

SafeSpec processes: evaluates results, creates defects if needed, updates compliance status, sends webhook to Nexum.

**Timing matters:** Driver submits at 6am and needs to start work. Target <10s for SafeSpec to process and return updated status.

---

## What SafeSpec Gets from Nexum

Nexum captures operational data during daily operations that SafeSpec can use for compliance assessments.

### Operational Data Ingestion

```
POST /compliance/operational-data
Body: {
  "tenantId": "uuid",
  "records": [
    {
      "type": "hours_worked",
      "driverId": "uuid",
      "date": "2026-03-19",
      "startTime": "06:00",
      "endTime": "16:30",
      "breakMinutes": 30,
      "totalHours": 10.0
    },
    {
      "type": "load_carried",
      "assetId": "uuid",
      "date": "2026-03-19",
      "grossWeight": 42.5,
      "tareWeight": 15.2,
      "netWeight": 27.3,
      "unit": "t"
    },
    {
      "type": "distance",
      "assetId": "uuid",
      "date": "2026-03-19",
      "distanceKm": 185.4
    }
  ]
}
```

| Data | When Nexum Sends | How SafeSpec Uses It |
|------|-----------------|---------------------|
| Hours worked (shift start/end, breaks) | Real-time | Fatigue management — must detect breaches quickly |
| Loads carried (weights, materials) | At daysheet processing | Mass compliance tracking |
| Distances driven | At daysheet processing | Maintenance schedule triggers |
| Driver-asset assignments | At allocation | Work diary records |

### Incident Reports

```
POST /compliance/incident
Body: {
  "tenantId": "uuid",
  "reportedBy": "uuid",
  "type": "vehicle_incident | workplace_injury | near_miss | property_damage",
  "description": "...",
  "involvedDriverId": "uuid",
  "involvedAssetId": "uuid"
}
```

SafeSpec takes ownership for WHS investigation and management.

---

## Shared Infrastructure

### Shared Compliance Package

Both products share a common npm package:

```
@redbay/compliance-shared
```

**Contents:**
- TypeScript types/interfaces for all API requests and responses
- Entity type enums (driver, asset, contractor)
- Compliance status enums (compliant, non_compliant, warning)
- Zod validation schemas for API payloads
- Webhook event type definitions
- Pre-start check type definitions

This ensures the API contract stays in sync during development.

### Shared Identity

- Both products use **Better Auth** — SSO across products
- **Shared UUIDs** for entities (drivers, assets, contractors) — no ID mapping needed
- **Shared tenant model** — one Nexum tenant maps to one SafeSpec tenant

---

## Design Considerations for SafeSpec

1. **Nexum connection is optional** — SafeSpec must work perfectly without any Nexum tenant connected. Don't depend on Nexum sending data.

2. **Stateless about Nexum** — If a Nexum tenant disconnects, SafeSpec continues normally. The operational data stream just stops.

3. **Performance is critical** — The batch status check is called when dispatchers load the scheduler. <500ms for 300 entities. Slow = dispatching blocked.

4. **Webhook reliability** — If a webhook is missed, a non-compliant entity could be used operationally for up to 15 minutes (cache TTL). Consider retry logic for failed webhook deliveries.

5. **Pre-start processing speed** — Drivers submit at 6am and need to start work. <10s target for processing and status update.

6. **Hours data is fatigue-critical** — Late hours data means fatigue breaches might not be detected in time. SafeSpec should flag if expected operational data hasn't arrived (e.g. no hours data in 24h for an active tenant).

7. **Multiple Nexum tenants** — SafeSpec is multi-tenant. Multiple Nexum instances may connect. The integration API should be tenant-scoped.

### Implementation Priority

For SafeSpec to support Nexum integration:

1. **Compliance status API** (single + batch) — Without this, no compliance features in Nexum
2. **Webhook notifications** — Without this, cached status goes stale
3. **Pre-start checklist definitions** — DriverX needs to render checklists
4. **Pre-start submission processing** — DriverX submissions need somewhere to go
5. **Operational data ingestion** — Enables fatigue/mass/maintenance assessment from Nexum operations

---

## OpShield Platform Layer

As of 2026-03-20, both SafeSpec and Nexum sit under the **OpShield** platform — a central layer that owns authentication (Better Auth SSO), tenant provisioning, billing (Stripe), and a platform admin dashboard.

- **OpShield does NOT broker API calls** between SafeSpec and Nexum. Products talk directly.
- **OpShield tells each product** when a tenant exists in the other product and provides connection details.
- **OpShield manages lifecycle** — if a tenant cancels one product, the other is notified.

See `docs/24-OPSHIELD-PLATFORM.md` for full architecture.

---

## Reference

Full Nexum documentation: `docs/` (this repo)
Compliance integration detail: `docs/12-COMPLIANCE-SAFETY.md`
Platform architecture: `docs/24-OPSHIELD-PLATFORM.md`
All decisions: `docs/DECISION-LOG.md`

**Project locations (dev server):**
- **OpShield**: `/home/redbay/OpShield`
- **Nexum**: `/home/redbay/Nexum-SaaS`
- **SafeSpec**: `/home/redbay/saas-project`
