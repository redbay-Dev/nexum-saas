# 15 — Documents

> File and document management across all entities — storage, versioning, sharing, compliance tracking, and generation.

## Overview

Every entity in Nexum has documents attached to it — drivers have licences, assets have registrations, contractors have insurance certificates, jobs have dockets and attachments. The document management system provides a unified approach to storing, versioning, tracking, sharing, and generating documents across the entire application.

All files are stored in DO Spaces (S3-compatible) with presigned URLs for secure access. Full version history is maintained. Document metadata auto-syncs to entity fields to reduce double-entry. Public sharing with security controls supports external distribution. Xero batch links attach proof-of-work to invoices.

## File Storage

### DO Spaces (S3-Compatible)

All documents are stored in DigitalOcean Spaces (S3-compatible API):
- Presigned URLs for secure, time-limited access (no direct S3 exposure)
- MIME type detection and validation on upload
- SHA256 checksums for duplicate detection and integrity verification
- File size tracking for storage reporting

### Human-Readable File Structure

S3 paths are human-readable — no UUIDs or hashed paths. The bucket mirrors how a person would organise files on a shared drive. Each entity gets its own root folder, and all documents sit within a logical subfolder structure.

**Bucket structure:**
```
/{tenant_slug}/
  Contractors/
    {Contractor Name}/
      Drivers/
        {Driver Name}/
          Licences/
          Medical/
          Inductions/
          DG Certificates/
          Qualifications/
      Assets/
        {Registration}/
          Registration/
          Insurance/
          Roadworthy/
          Weight Certificates/
          Photos/
      Company Documents/
        Public Liability/
        Workers Comp/
        NHVAS/
        Agreements/
  Customers/
    {Customer Name}/
      Company Documents/
      Job Requests/
  Jobs/
    {Job Number}/
      Dockets/
      Daysheets/
      Attachments/
  Company Assets/
    {Registration}/
      (same structure as contractor assets)
  Company Drivers/
    {Driver Name}/
      (same structure as contractor drivers)
  Price Lists/
    {Supplier Name}/
  Invoices/
    {Year}/{Month}/
  RCTIs/
    {Year}/{Month}/
  Quotes/
    {Year}/{Month}/
```

Entity names in paths are slugified (spaces → hyphens, lowercase, special characters stripped). If an entity is renamed, the S3 path updates and existing presigned URLs remain valid for their expiry period.

### Standard File Naming

Files are automatically renamed on upload to a consistent, human-readable format. Users can also rename files manually.

**Auto-naming convention:** `{Entity}_{Document Type}_{Date}_{Sequence}.{ext}`

**Examples:**
- `Smith-Transport_Public-Liability_2026-03-19_001.pdf`
- `ABC456_Registration_2026-01-15_001.pdf` (asset by rego)
- `John-Smith_Licence-Front_2026-03-19_001.jpg`
- `JOB-2024-0153_Weighbridge_2026-03-19_003.pdf`
- `INV-2026-0042.pdf` (generated invoices)
- `RCTI-2026-0018.pdf` (generated RCTIs)

**Naming rules:**
- On upload, the system proposes a standardised name based on entity + document type + date
- User can accept or customise before confirming
- Duplicate names within the same folder get an auto-incrementing sequence number
- Manual rename available at any time (updates S3 key, old presigned URLs still work until expiry)
- Bulk rename available for cleaning up legacy/imported files

### Image Optimisation

Uploaded images are automatically compressed:
- Converted to WebP format for reduced storage and faster loading
- Configurable quality (default 80%)
- Original preserved as a version if needed
- Applied to photos (asset photos, site photos) — not to scanned documents where quality matters

### Storage Tiers

Documents move through storage tiers based on age and access patterns:
- **Hot** — Active documents, frequently accessed (default for new uploads)
- **Warm** — Recent but less frequently accessed
- **Cold** — Older documents, infrequently accessed
- **Archive** — Retention-only, rarely accessed (compliance/legal hold)

Tier transitions can be automated via S3 lifecycle policies. The application tracks the current tier for UI indicators (cold/archive documents may have slower retrieval).

## Document Types by Entity

### Driver Documents
- Licence (front/back)
- Medical certificate
- Dangerous goods certificate (with DG class metadata)
- Qualifications and training certificates
- Induction records
- Photos (profile)

### Asset Documents
- Registration certificate
- CTP insurance
- Comprehensive insurance
- Roadworthy/safety inspection certificate
- Weight certificate
- PBS approval documentation
- Service records (with provider, service type, odometer metadata)
- Asset photos

### Business Company Documents (Contractors, Suppliers, Customers)
- Public liability insurance
- Workers compensation certificate
- NHVAS accreditation certificates (mass, maintenance, fatigue)
- Subcontractor agreements
- ABN certificates
- Other compliance documents

### Job Documents
- **Dockets** — Weighbridge tickets, tip receipts, delivery notes (doc 08)
- **Attachments** — Transport management plans, site maps, safety plans, permits, contracts, quotes, specifications, photos

### Price List Documents
- Supplier price lists (PDF/image)
- Disposal site rate sheets
- Linked to business companies and addresses
- Effective date tracking

## Version Control

Every document maintains a complete version history.

**How it works:**
- Each re-upload of a document creates a new version (auto-incrementing version number)
- Only one version is marked as "current" at any time
- Previous versions remain accessible for audit and rollback
- Each version records: who uploaded it, when, from where (portal, manual, API, system), and why (upload reason)

**Version operations:**
- View version history for any document
- Download any previous version
- Restore a previous version as current
- Compare versions (metadata changes)

**Audit trail:** Version history provides a complete record of document changes — who replaced a licence, when the insurance was last updated, whether a document was rolled back.

## Document Metadata Auto-Sync

When a document is uploaded with metadata (issue date, expiry date, document number), the system automatically updates the corresponding entity fields.

**Driver sync examples:**
- Upload licence → updates `licence_expiry` on the driver record
- Upload medical certificate → updates `medical_certificate_expiry`
- Upload DG certificate → updates `dangerous_goods_expiry` and DG classes

**Asset sync examples:**
- Upload registration → updates `registration_expiry`
- Upload CTP → updates `ctp_expiry`
- Upload roadworthy → updates `roadworthy_expiry`, inspector info, coverage amounts

**Contractor sync examples:**
- Upload public liability → updates `public_liability_expiry`
- Upload workers comp → updates `workers_comp_expiry`
- Upload NHVAS certificate → updates relevant accreditation expiry and number

This eliminates double-entry — upload the document once, the system extracts and applies the metadata. If SafeSpec is connected, updated expiry data flows through to compliance status.

## Type-Specific Metadata

Each document type has its own metadata schema stored as JSONB:
- **Medical certificates:** Provider name, certificate number
- **Insurance documents:** Insurer, policy number, coverage amount
- **DG certificates:** Licence number, DG classes (array)
- **Service records:** Service provider, service type, odometer reading
- **Qualifications:** Qualification type, issuing body, competency level

Metadata schemas are configurable — tenants can extend them with custom fields relevant to their operations.

## Expiry Tracking

Documents with expiry dates are actively tracked:
- Dashboard showing documents expiring within configurable periods (7, 14, 30, 60, 90 days)
- Grouped by entity type (drivers, assets, contractors)
- Colour-coded urgency (expired = red, expiring soon = amber, valid = green)
- Notification triggers when documents enter warning periods (doc 13 notifications)
- Bulk view for fleet-wide expiry management

If SafeSpec is connected, expiry status feeds into compliance checks. Without SafeSpec, the expiry dashboard is the tenant's primary compliance visibility tool.

## Sharing & Public Links

### Public Document Links

Documents can be shared externally via public links:
- Configurable expiry (1–90 days, default 30)
- Optional password protection (bcrypt hashed)
- Optional download limits (max downloads before link deactivates)
- Download counter and access tracking
- Revocation — links can be disabled at any time
- Access logging (who accessed, when, IP address)

### Xero Batch Links

For invoice attachments sent to Xero:
- Single link generated for all docket images in an invoice/RCTI
- 90-day expiry for Xero attachments
- Batch tracking (which dockets are included)
- Access statistics for audit
- Links attached to the Xero invoice as a URL reference

### Portal Access

With the portal (doc 14), many sharing scenarios are handled through portal access instead of public links:
- Contractors view their documents directly in the portal
- Customers view invoice attachments through the portal
- Public links remain for ad-hoc sharing outside the portal (e.g. sending a docket to a third party)

## Trash & Recovery

Documents use soft-delete with a 30-day recovery window:
- Deleted documents move to trash (not permanently removed)
- 30-day countdown before automatic permanent deletion
- Full original data snapshot preserved for restoration
- Delete reason and deleted-by tracking
- Bulk restore and permanent delete operations
- Trash view with colour-coded urgency (days remaining)

Permanent deletion requires explicit `documents.admin` permission and is logged.

## Access Control

### Permissions

Document access is permission-controlled:
- `documents.view` — View and preview documents
- `documents.download` — Download document files
- `documents.upload` — Upload new documents
- `documents.delete` — Soft-delete documents (move to trash)
- `documents.restore` — Restore documents from trash
- `documents.share` — Create public sharing links
- `documents.admin` — Full management including permanent deletion and access log review

### Audit Logging

All document interactions are logged:
- Operations: view, download, upload, share, delete, restore
- Access method: direct (app), public link, Xero integration, API, portal
- User, timestamp, IP address, user agent
- Additional context metadata (e.g. Xero invoice ID, share recipient)

## PDF Generation

The system generates PDFs for various business documents:
- **Invoices** — Customer invoices with line items, attached docket images
- **RCTIs** — Contractor remittance advice with deductions and docket images
- **Quotes** — Customer quotes with pricing
- **Statements** — Customer and contractor statements with ageing
- **Reports** — Financial and operational reports (doc 17)

PDF generation uses the Puppeteer + Handlebars approach from SafeSpec:
- Handlebars templates for each document type
- Tenant branding (logo, colours, contact details) injected into templates
- Puppeteer renders HTML to PDF
- Generated PDFs stored in S3 with the same versioning and sharing capabilities

### Template Customisation

Tenants can customise document templates:
- Logo placement and branding
- Footer text and terms & conditions
- Which fields appear on invoices/RCTIs
- Custom notes per document type
- Template preview before applying changes

## Document Publishing (Invoices)

When an invoice is published:
1. System collects all relevant docket images for the invoice lines
2. Filters by type (weighbridge, daysheet, supporting)
3. Generates presigned URLs with extended expiry
4. Creates public links for customer access
5. Attaches to Xero invoice if Xero integration is active
6. Customer can view via portal or public link

## Document Manager

The document manager is a full file management interface — like a cloud drive built into Nexum. It mirrors the S3 folder structure so users navigate documents the same way they'd navigate folders on their computer.

### Folder Navigation

Left panel shows the folder tree matching the S3 structure:
- Root folders: Contractors, Customers, Jobs, Company Assets, Company Drivers, Price Lists, Invoices, RCTIs, Quotes
- Expand any root to see entities (contractor names, job numbers, etc.)
- Expand entities to see subfolders (Licences, Insurance, Dockets, etc.)
- Click a folder to see its contents in the main panel
- Breadcrumb navigation at the top for quick path traversal
- Folder counts showing number of files within

### File Listing

Main panel shows files in the selected folder with full detail:
- File name (standardised name, not raw upload name)
- Document type
- File size and format
- Upload date and uploaded by
- Issue date and expiry date (where applicable)
- Version count (click to expand version history)
- Status (active, expired, pending approval, archived)
- Compliance status indicator (green/amber/red if expiry-tracked)
- Last accessed date and access count
- Storage tier indicator

**Display modes:**
- List view (default — full detail per row)
- Grid view (thumbnail previews for image-heavy folders like docket photos)
- Sortable by any column
- Filterable by status, type, date range, expiry

### File Operations

Full control over every file:
- **Upload** — Drag-and-drop or file picker. System proposes standardised name. Metadata form based on document type. Multi-file upload supported.
- **Download** — Single file or bulk download (ZIP for multiple). Download any version.
- **View/Preview** — In-app preview for PDFs, images, and common formats. No download required for viewing.
- **Edit metadata** — Update document type, issue/expiry dates, custom metadata fields, notes. Metadata changes logged.
- **Rename** — Change the file name. S3 key updates. Old presigned URLs still work until expiry.
- **Move** — Move files between folders (e.g. misfiled document moved to correct entity). Move is logged in audit trail. Original entity reference updates.
- **Delete** — Soft-delete to trash (30-day recovery). Permanent delete requires admin permission.
- **Share** — Generate public link with expiry, password, download limit options.
- **Version history** — View all versions, download any version, restore a previous version as current.

### Bulk Operations

- Bulk upload (multiple files to the same folder)
- Bulk download (select multiple → ZIP)
- Bulk move (select multiple → choose destination folder)
- Bulk rename (select multiple → apply naming convention)
- Bulk delete (select multiple → soft-delete)

### Search

Global search across all documents:
- By file name, document type, entity name
- By metadata fields (document number, policy number, insurer, etc.)
- By date range (uploaded, issued, expiring)
- By status (current, expired, pending approval, in trash)
- Partial-match, app-wide search principle (DEC-056)
- Search results show full file details with folder path — click to navigate to location

### Quick Access

- **Recent** — Last 20 files accessed or uploaded
- **Expiring soon** — Documents within warning period, grouped by urgency
- **Pending approval** — Portal-uploaded documents awaiting tenant review (doc 14)
- **Starred/Pinned** — User-pinned frequently accessed documents

### Storage Dashboard

Admin view showing:
- Total storage used per tenant
- Storage breakdown by entity type (how much space do job dockets consume vs driver documents)
- File count by type and status
- Storage tier distribution
- Largest files
- Orphaned files (documents not linked to any active entity)

## Migration from Nexum

All existing S3-stored documents carry forward with their metadata, version history, and access logs. The storage bucket structure may change to accommodate schema-per-tenant, but documents themselves are preserved. Public links with active expiry dates remain valid through migration.
