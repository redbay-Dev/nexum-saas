# 05 — Materials & Disposal

## Overview

Materials are what gets moved — fill, soil, sand, rock, aggregate, concrete, asphalt, mulch, hazardous waste, and everything in between. The materials system tracks what materials exist, where they are (at which addresses), what they cost, what compliance requirements they carry, and how they behave in jobs.

Nexum's current materials system uses four separate tables for different material sources (company, supplier, customer, disposal) plus unified views. The rebuild keeps separate tables per source — this is architecturally correct because each source context has different fields, different naming, and different pricing (buy vs sell). The tables just need to be cleaner and more consistent in their shared fields. Pricing behaviours carry forward conceptually but the configuration experience needs to be cleaner — pricing details are covered in doc 09 (Pricing Engine).

## Material Types — Hierarchical Categories

Materials are organised in a two-level hierarchy:

- **Categories** — Broad material groups (Fill, Soil, Sand, Rock, Aggregate, Road Base, Concrete & Demolition, Asphalt, Recycled, Mulch & Organic, Hazardous / Regulated, Specialty). These are system-seeded defaults but tenant-configurable — tenants can add, rename, reorder, or disable categories.
- **Subcategories** — Specific material types within a category (e.g., under Sand: Brickies Sand, Concrete Sand, Washed Sand, Plaster Sand). Tenants define their own subcategories based on the materials they actually handle.

The hierarchy is useful for filtering, reporting, and organising materials — particularly for tenants dealing with many material types across multiple suppliers and disposal sites. Each material record links to a subcategory (which inherits its parent category), giving structure to what could otherwise be a sprawling flat list.

The system ships with approximately 139 default subcategories across the 12 categories, covering the most common Australian transport materials. Tenants can use these as-is, modify them, or create their own from scratch.

## Material Catalog — Separate Tables per Source, Done Cleaner

### Why separate tables are correct
Nexum uses four separate tables for materials from different sources. This is architecturally correct because each source context is genuinely different:

- **Different naming** — A supplier might call it "20mm Bluey", a disposal site calls it "Blue Metal 20mm", the customer calls it "Crushed Rock", and the tenant has their own name for it. Every party has their own naming conventions.
- **Different fields** — Buying context needs purchase price, supplier product code, minimum order quantity. Selling context needs sale price, markup. Disposal context needs tip fee, environmental levy, material mode. These aren't the same fields with different names — they're fundamentally different data.
- **Different configuration** — Each source's materials need to be independently configurable by the tenant.

Forcing all of this into a single table with nullable columns and a source_type flag would create a confusing record where most fields don't apply to most rows.

### The rebuild approach: separate tables, cleaner implementation
Keep separate tables per source, but improve them:

**Tenant materials** — Materials the tenant has in their own stockpiles or manages directly. Name, material type, unit of measure, compliance flags, address (where it's stored).

**Supplier materials** — Materials available from suppliers. Supplier name for the material (may differ from tenant's name), purchase price, supplier product code, material type, unit of measure, address (which quarry/depot), compliance flags, minimum order quantity.

**Customer materials** — Customer-specific material records. Customer's name for the material, material type, unit of measure, sale price, address (which job site/location), compliance flags.

**Disposal materials** — Materials at disposal sites, with material mode (disposal or supply). Disposal mode carries tip fee, environmental levy, minimum charge. Supply mode carries sale price. Plus compliance flags, waste codes, EPA tracking requirements. Always linked to an address.

**Disposal site settings** — Site-level configuration separate from individual material records: operating hours, accepted/rejected material lists, EPA licence details, waste codes, account/credit terms, pre-approval requirements, accounts contact.

### Shared consistency
While the tables are separate, they share consistent patterns:

- All link to the material type hierarchy (categories/subcategories)
- All link to addresses (materials belong to locations)
- All carry compliance flags (hazardous, DG, EPA)
- All have unit of measure
- All support active/inactive status

### Materials belong to addresses
This is unchanged from Nexum and is correct. Materials exist at specific locations — a supplier's quarry, a disposal site's tip face, a customer's job site, or the tenant's stockyard. Each material record links to an address. The same supplier can have different materials available at different locations, and the same material at different locations can have different prices.

## Disposal Sites — Dual Nature

Disposal sites are unique in that they both **accept** material (waste disposal) and **supply** material (recycled products). This dual nature is fundamental to how they operate in practice.

### Accept mode (disposal)
When a disposal site accepts waste:

- Charges a **tip fee** per unit (per tonne, per cubic metre, per load)
- May charge an **environmental levy** on top of the tip fee
- May have a **minimum charge** per transaction
- Tracks which materials the site accepts and rejects
- EPA tracking may be required depending on waste classification

### Supply mode
When a disposal site supplies recycled material:

- Has a **sale price** per unit for each product
- Products are typically recycled from accepted waste (crushed concrete becomes road base, screened soil becomes clean fill)
- Pricing and availability separate from the disposal side

### Each material at a disposal site has a mode
The `material_mode` flag (disposal or supply) determines which pricing and behaviour applies. Some materials exist in both modes — a site might accept concrete waste (disposal mode with tip fee) and sell crushed recycled concrete (supply mode with sale price).

### Site settings
Each disposal site address carries operational settings: operating hours, accepted/rejected material lists, EPA licence details, waste codes, account/credit terms, and pre-approval requirements. These govern the site's overall operation, separate from individual material records.

## Material in Jobs — Immutable Snapshots

When a material is added to a job, the system captures an **immutable snapshot** of the material at that point in time. This snapshot includes: the material name, description, type, pricing, unit of measure, and compliance flags — all frozen at job creation. If the supplier changes their price next week, it doesn't affect existing jobs. You need to know what was quoted, not what the current price is.

### Flow types
Each material in a job has a flow type that describes the direction of material movement:

- **Supply** — Material moves from a supplier/source to a destination (e.g., quarry to job site)
- **Disposal** — Material moves from a source to a disposal site (e.g., job site to tip)
- **Buyback** — Material is purchased back (e.g., excess fill bought back from a site)
- **Transfer** — Material moves between two sites (e.g., stockpile to stockpile)
- **Delivery** — Material delivered to a specific address

Each flow type captures source and destination: company, address, and pricing at both ends.

### Pricing behaviours
The pricing behaviour determines what financial lines are generated for a material in a job. The concepts carry forward from Nexum:

- **Transport revenue** — Standard cartage job. Revenue line for the transport service. The material is tracked but the charge is for moving it.
- **Material cost** — The tenant purchases material (from a supplier or disposal site) for the job. Cost line generated. Used when the tenant is buying material on behalf of the customer.
- **Material resale** — Tenant buys material at one price and sells at another. Both cost and revenue lines generated. This is the margin scenario.
- **Tracking only** — Material is tracked for operational/compliance purposes but no pricing lines are generated. Used for materials the customer supplies or for movement tracking without billing.

The specific pricing configuration (rates, markups, how prices are determined) is covered in **doc 09 — Pricing Engine**. This doc defines the material model; doc 09 defines how prices are calculated and applied.

### Quantity tracking
Each material in a job tracks multiple quantity states:

- **Quantity** — Ordered/estimated quantity
- **Loaded quantity** — Actually loaded on the vehicle
- **Delivered quantity** — Actually delivered to destination
- **Actual quantity** — Final confirmed quantity (may differ from delivered if adjusted during verification)

These support the real-world workflow where the ordered amount, loaded amount, and delivered amount rarely match exactly. Discrepancies feed into docket verification (doc 08) and invoicing (doc 10).

### Subcontractor rates
When a contractor's asset is used for the job, the material carries a subcontractor rate — always a fixed value. Typically this is around 10% less than the job rate (for hourly work) or the material rate (for contract-based work). The subcontractor rate feeds into RCTI generation (doc 10).

### Billing account
Each material in a job can specify who pays for the material:

- **Null (default)** — Tenant pays the supplier
- **Customer** — Customer pays the supplier directly (direct billing / pass-through)
- **Third party** — Another company pays (e.g., project manager pays for materials on a construction project)

## Material Compliance

Material compliance stays in Nexum — it's operational data about what's being moved, not WHS/NHVL regulatory compliance. The transport operator needs to know immediately whether the load they're carrying has special handling requirements.

### Hazardous material flags
- **is_hazardous** — General hazardous flag
- **is_regulated_waste** — Regulated waste requiring tracking
- **is_dangerous_goods** — Classified dangerous goods
- **requires_tracking** — Material movement must be tracked end-to-end
- **requires_authority** — Requires authorisation before transport

### Dangerous goods classification
For DG materials, the full classification:

- **UN number** — United Nations classification number
- **DG class** — Dangerous goods class (1–9)
- **Packing group** — I (great danger), II (medium danger), III (minor danger)

This information flows into job creation (triggering DG-specific requirements), docket processing, and compliance reporting.

### EPA waste tracking
For regulated waste, state-specific EPA classifications:

- **Waste code** — EPA-specific waste classification code
- **State-specific categories** — QLD and NSW have different waste category systems; the material record captures the relevant classification for the state of operation

EPA tracking requirements flow through to disposal dockets and may trigger specific documentation or reporting obligations.

### Compliance in job snapshots
When a material with compliance flags is added to a job, those flags are captured in the immutable snapshot. This means the compliance requirements for a job's materials are preserved even if the material's classification is later updated — critical for audit and regulatory purposes.

## Units of Measure

Materials are priced and tracked in one unit — there is no conversion between units. The standard units are:

- **Tonne (t)** — Weight-based pricing and tracking
- **Metre (m³)** — Volume-based pricing and tracking
- **Load (l)** — Per-load pricing (regardless of weight or volume)
- **Hour (hr)** — Time-based pricing
- **Kilometre (km)** — Distance-based pricing

A material is assigned one unit of measure. If a material is priced per tonne, it's tracked in tonnes. If it's priced per cubic metre, it's tracked in cubic metres. They don't convert between each other.

### Density factor (new — not currently in Nexum)
As a configuration option, materials could carry a density factor (tonnes per cubic metre) as reference data. This would be informational — helping dispatchers and drivers understand the relationship between volume and weight for load planning purposes (e.g., knowing that clean fill at ~1.5 t/m³ will hit mass limits before filling the body, while mulch at ~0.4 t/m³ will fill the body before hitting mass limits). This does not change the pricing or tracking unit — it's a planning aid only.

## What's Different from Nexum

| Aspect | Nexum | Rebuild |
|--------|-------|---------|
| Material tables | 4 separate tables + unified views | Separate tables per source (correct architecture), cleaner implementation with consistent shared patterns |
| Material sources | Separate handling per source type | Same — separate tables are correct due to different fields, naming, and buy/sell contexts |
| Type hierarchy | 12 categories, ~139 subcategories (tenant-configurable) | Same — carries forward |
| Disposal sites | Dual nature (accept + supply) with site settings | Same — carries forward |
| Pricing behaviours | transport_revenue, material_cost, material_resale, tracking_only | Same concepts — configuration simplified (see doc 09) |
| Job snapshots | Immutable material snapshots at job creation | Same — carries forward |
| Compliance | Hazardous, DG, EPA tracking in Nexum | Same — stays in Nexum (operational data) |
| Pricing configuration | Multiple overlapping configuration points (confusing) | Simplified — single clear precedence chain (see doc 09) |

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 2*
