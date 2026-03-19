# 17 — Reporting & Analytics

> Financial, operational, and performance reporting with scheduled delivery, portal access, dashboards, and a custom report builder.

## Overview

All existing Nexum reports carry forward with improved visualisation, deeper drill-down, and additional capabilities. Reporting is organised into five areas: financial, operational, performance, compliance, and customer/contractor reporting. Scheduled delivery is enhanced with more triggers and portal-based access alongside email. A custom report builder lets tenants create their own reports from available data fields.

## Dashboard

The main dashboard is the first thing users see on login. It provides a real-time operational snapshot.

**Operational metrics:**
- Jobs today / tomorrow / next 7 days
- Jobs by status (scheduled, in progress, completed, overdue)
- Jobs by priority distribution
- Unassigned jobs requiring attention
- High-priority jobs flagged

**Resource metrics:**
- Asset utilisation (owned vs contractor)
- Driver allocation and availability
- Assets in maintenance
- Capacity vs demand (next 7 days with daily breakdown)
- Tonnage capacity forecast with utilisation percentages

**Financial snapshot:**
- Revenue today / this week / this month
- Outstanding invoices total and count
- Overdue invoices flagged
- Cash flow indicator (incoming vs outgoing)

**Compliance alerts (if SafeSpec connected):**
- Entities with expiring or expired documents
- Non-compliant assets/drivers flagged
- Upcoming compliance deadlines

**Fleet optimisation recommendations:**
- Asset shortfall forecasting
- Underutilised assets
- Scheduling inefficiencies detected

Dashboard widgets are configurable per user — drag to reorder, show/hide widgets, resize.

## Financial Reports

### Revenue Reports

- Revenue by period (daily, weekly, monthly, quarterly, yearly)
- Revenue by customer (ranked, with growth trends)
- Revenue by job type
- Revenue by material type
- Revenue by region/area
- Period comparison (this month vs last month, this quarter vs same quarter last year)
- Growth rate tracking

### Cost Reports

- Cost breakdown by category (labour, materials, contractors, assets, other)
- Cost by period with trending
- Cost per job analysis
- Cost per tonne / per hour / per kilometre
- Contractor cost analysis (by contractor, by period)
- Supplier cost analysis

### Profitability Reports

- Profit margin by job, customer, job type, material, region
- Margin trend over time
- Low-margin job identification (below configurable threshold)
- Profitability ranking (most to least profitable customers, job types, routes)
- Budget vs actual variance

### Accounts Receivable

- Invoice aging report (current, 30+, 60+, 90+ days)
- Customer aging breakdown with totals
- Overdue invoice count and value
- Cash flow chart (receivables vs payables over time)
- Payment trend analysis (average days to pay by customer)
- Credit utilisation (customers approaching credit limits)

### Accounts Payable

- RCTI aging and status
- Contractor payment summary
- Supplier invoice tracking
- Outstanding AP by period

### Weight Overage Reports

- Overages by driver, asset, route, customer, material
- Overage frequency and severity
- Pattern detection (habitual offenders, problematic routes/weighbridges)
- Compliance impact assessment
- Trend analysis over time

## Operational Reports

### Asset Utilisation

- Utilisation rate per asset (percentage of available hours used)
- Utilisation trends (weekly, monthly)
- Active vs idle analysis
- Cost per hour by asset
- Tonnes per hour productivity
- Asset status distribution
- Comparison across fleet (identify underperformers)
- Owned vs contractor asset utilisation comparison

### Job Performance

- Scheduled vs actual hours (efficiency rate)
- On-time completion percentage
- Delay analysis (hours delayed, reasons where tracked)
- Jobs by status over time
- Completion rate trends
- Performance by job type
- Resource efficiency per job

### Scheduling Efficiency

- Lead time analysis (time from creation to scheduling)
- Reschedule frequency
- Cancellation rate
- Allocation accuracy (how often are allocations changed after initial assignment)
- Auto-allocation performance (if AI scheduling enabled — accuracy, override rate)

### Delivery & Material Tracking

- Tonnes/m³ delivered by period
- Delivery counts by customer, material, site
- Project delivery progress (quantities delivered vs ordered)
- Material movement reports (from site A to site B)

## Performance Reports

### Driver Performance

- Total deliveries, jobs, tonnes, m³, hours, distance
- Productivity metrics (tonnes per hour, tonnes per job)
- Regular vs overtime hours
- Efficiency scoring
- Performance ranking across drivers
- Trend over time per driver

### Contractor Performance

- Jobs assigned and completed
- Completion rate
- Total costs and average cost per job
- Driver count and utilisation
- Contractor ranking
- Cost efficiency comparison

### Sales Rep Performance

- Jobs sold and revenue generated
- Customer count
- Average revenue per job
- Completion rates for their jobs
- Performance ranking by revenue

## Compliance Reports

If SafeSpec is connected, compliance reports reflect SafeSpec data. Without SafeSpec, reports are based on document expiry tracking (doc 15).

- Document expiry status across all entities
- Expiring within 7/14/30/60/90 days
- Expired documents requiring action
- Compliance status distribution (compliant, warning, expired, non-compliant)
- Compliance trend over time
- Audit preparation reports (entity-by-entity compliance summary)

## Customer & Contractor Reporting

### Scheduled Report Delivery

Reports can be automatically generated and delivered on schedule.

**Configuration per customer/contractor:**
- Report type: none, per_job, daily, weekly, monthly
- Configurable sections per report (summary, progress, loads, materials, hours, costs, attachments, photos, signatures, notes)
- Delivery channel: email (primary), portal access (always available)
- Email recipients: primary + CC + BCC
- Customisable subject line and message
- Format: HTML email, PDF attachment, or both
- Optional docket PDF attachments
- Timezone-aware scheduling (send time and day configurable)
- Activity-based sending (skip if no activity in the period)

**Report triggers:**
- Per load (on docket completion)
- Per daysheet (on daysheet processing)
- On job completion
- On milestone (every N loads)
- Daily summary (configurable send time)
- Weekly summary (configurable day and time)
- Monthly summary
- Manual trigger (generate and send on demand)

**Report templates:**
- Create reusable templates with section configuration
- Set a default template applied to new customers
- Apply template to multiple customers at once
- Tenant branding (logo, colours, contact details)
- Configurable cost visibility (show/hide costs in customer reports)
- Internal notes visibility toggle

**Delivery tracking:**
- Report history with status (pending, sent, failed, cancelled)
- Failed report retry
- Test report functionality (send test to verify format)
- Delivery log with timestamps and recipients

### Portal Report Access

Customers and contractors access reports through their portal (doc 14):
- All scheduled reports available for download in portal
- Self-service date range reports
- Real-time data (not just periodic snapshots)
- Export to CSV/PDF from portal

## Custom Report Builder

Tenants can create their own reports from available data fields — no code required.

### How It Works

**Data sources:**
- Jobs (all job fields, status, dates, locations, materials, allocations)
- Pricing (revenue lines, cost lines, margins, rates)
- Invoices (amounts, status, aging, payment dates)
- RCTIs (amounts, status, deductions, payment dates)
- Dockets/Daysheets (quantities, weights, hours, processing status)
- Assets (utilisation, availability, maintenance status)
- Drivers (hours, deliveries, performance metrics)
- Customers (revenue, job count, aging, credit status)
- Contractors (costs, job count, performance)
- Documents (expiry status, compliance)

**Building a report:**
1. Select data source(s) — choose which entities to report on
2. Select fields — drag available fields into the report layout (columns)
3. Apply filters — filter by date range, status, customer, job type, etc.
4. Group by — group results by period, customer, job type, material, driver, asset, etc.
5. Sort — define sort order
6. Aggregations — sum, average, count, min, max on numeric fields
7. Charts — optionally add chart visualisation (bar, line, pie, stacked)
8. Preview — see the report with live data before saving

**Saved reports:**
- Save with name and description
- Report library per tenant (shared across users with permission)
- Schedule for automatic delivery (same scheduling options as pre-built reports)
- Export to CSV, PDF, or both
- Duplicate and modify existing reports

**Limitations:**
- Read-only — report builder cannot modify data
- Tenant data only — scoped to the tenant's data
- Performance limits — complex reports with large date ranges may be queued for background generation
- No cross-tenant reporting (platform admin has separate tools)

### Report Sharing

- Share a saved report definition with other users in the tenant
- Share a generated report as a link (time-limited, like document sharing)
- Include custom reports in scheduled customer delivery

## AI-Powered Reporting

Integration with AI features (doc 16):

**Natural language queries:**
- "Show me revenue by customer for Q1" → generates the report
- "Compare this month's margins to last month" → generates comparison
- Results formatted as a readable response with supporting charts/tables

**Proactive insights:**
- AI analyses report data and surfaces notable trends
- "Revenue from Customer X dropped 25% this month"
- "Driver Y's productivity has increased 15% since last quarter"
- "Margins on tonnage jobs in the North region are trending down"

**Report suggestions:**
- AI suggests relevant reports based on user's role and recent activity
- "You haven't reviewed aging reports this month — 3 customers are 60+ days overdue"

## Export & Integration

All reports support:
- CSV export (raw data for spreadsheet analysis)
- PDF export (formatted with tenant branding)
- Print-optimised views
- Xero integration for financial reports (data reconciliation)

## Permissions

- `reports.view` — View pre-built reports
- `reports.financial` — Access financial reports (revenue, costs, margins, aging)
- `reports.operational` — Access operational reports (utilisation, efficiency, scheduling)
- `reports.performance` — Access performance reports (drivers, contractors, sales reps)
- `reports.compliance` — Access compliance reports
- `reports.builder` — Create and manage custom reports
- `reports.schedule` — Configure scheduled report delivery
- `reports.admin` — Full reporting access including platform-level metrics
