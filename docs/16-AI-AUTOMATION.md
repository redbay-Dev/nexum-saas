# 16 — AI & Automation

> AI-powered features and configurable automation across the platform — provider-flexible, tenant-configurable, built for progressive capability.

## Overview

AI is woven throughout the application, not bolted on as a separate feature. Every AI capability uses the provider-flexible architecture — an abstract interface with adapters for multiple providers. Tenants configure which AI features are active and how aggressively they operate. Automation runs on BullMQ job queues with a lightweight workflow engine for tenant-configurable rules.

The principle: AI should handle anything repetitive, pattern-based, or time-consuming. Humans handle exceptions, approvals, and decisions that require judgement.

## Provider-Flexible AI Architecture

### Abstract Interface

All AI features go through a unified AI service layer:
- Abstract interface defining capabilities (text generation, structured extraction, image analysis, embeddings)
- Provider adapters: Google Gemini, OpenAI, Anthropic (initial three)
- Adding a new provider means implementing one adapter — no changes to feature code
- Provider selection configurable at tenant level or system-wide default

### Configuration

- System default provider set by platform admin (cost/quality balance for most tenants)
- Tenant override available (some tenants may prefer a specific provider or bring their own API key)
- Per-feature provider override possible (e.g. use Gemini for job parsing but Anthropic for document analysis)
- API key management: platform-provided keys (cost included in subscription) or tenant's own keys (BYOK)
- Usage tracking per tenant for cost allocation and rate limiting

### Fallback & Resilience

- Primary provider fails → automatic fallback to secondary provider
- All AI features degrade gracefully — if AI is unavailable, manual workflows continue uninterrupted
- Response caching where appropriate (e.g. entity matching results)
- Rate limiting per tenant to prevent abuse and manage costs

## AI Features

### 1. Conversational Job Creation

Carries forward from Nexum with improvements. Users describe jobs in natural language and the AI creates structured job data through a multi-turn conversation.

**How it works:**
- User opens AI Job Creator and describes the job in plain English
- AI parses the description, matching fuzzy entity references against the database (customers, materials, addresses, assets)
- AI asks smart follow-up questions for missing information (pricing structure, disposal fees, truck types, sub-rates)
- Split-pane UI: conversation on the left, live job summary on the right
- Preview includes estimated P&L with revenue/cost breakdown
- User confirms → job is created with all pricing lines

**Domain intelligence:**
- Understands transport-specific concepts (tip fees, sub-rates, hourly vs tonnage billing, customer-supplied trucks)
- Knows that $0 material rate on hourly jobs is normal
- Parses relative dates ("Monday", "next Tuesday")
- Suggests typical sub-rates (e.g. ~90% of invoice rate)
- Handles multi-docket-line jobs with different truck types and pricing models per line

**Edit mode:**
- AI receives full readable summary of current job state
- User describes changes in natural language
- AI applies changes and highlights what was modified
- Suggests improvements (missing tip fees, no sub-rate, margin issues)

### 2. AI Job Review

Pre-save validation that catches issues before they become problems.

**What it checks (6 areas):**
- **Scheduling** — Date conflicts, missing start times, past dates
- **Dockets** — Material/location mismatches, missing docket configuration
- **Pricing** — Margin below threshold, missing cost lines, billing type inconsistencies, $0 rates that shouldn't be
- **Invoicing** — Missing billing schedule, customer credit status, incomplete billing setup
- **Locations** — Missing pickup/delivery, address validation, disposal site without tip fee
- **Configuration** — Missing job type, incomplete requirements, unassigned job lead

**Output:**
- Structured report with issues categorised by severity (critical, warning, info)
- Each issue includes the specific values found and what's expected
- Overall summary with actual figures (margins, totals, rates)
- One-click navigation to fix each issue

### 3. Docket OCR & Reading

AI reads uploaded docket images and pre-populates fields (doc 08).

**What it reads:**
- Weighbridge tickets: gross weight, tare weight, net weight, material type, date/time, ticket number
- Tip receipts: disposal site, material, quantity, fee, receipt number
- Delivery notes: quantities, material descriptions, reference numbers

**How it works:**
- Image uploaded (camera, file picker, portal, DriverX)
- AI analyses the image and extracts structured data
- Confidence score per extracted field (high/medium/low)
- Low-confidence fields highlighted for human review
- Human confirms or corrects → data saved
- Full manual entry always available as fallback

**Learning:**
- Common docket formats from specific weighbridges/sites become more accurate over time
- Tenant-specific extraction rules for non-standard formats

### 4. Smart Scheduling & Auto-Allocation

AI-powered scheduling recommendations and progressive auto-allocation (DEC-060).

**Recommendation engine:**
- When a job needs resources, AI scores available assets and drivers
- Scoring factors: proximity, availability, equipment match (subcategory level), driver familiarity with site/customer, historical performance, cost efficiency, fatigue/hours status
- Recommendations ranked with scores and reasoning
- Dispatcher sees top recommendations and can accept or override

**Progressive auto-allocation levels (tenant-configurable):**
- **Level 0: Manual** — AI provides recommendations, dispatcher makes all decisions
- **Level 1: Suggest** — AI proposes allocations, dispatcher confirms each one
- **Level 2: Auto-routine** — AI auto-allocates routine/simple jobs, dispatcher handles exceptions
- **Level 3: Full auto** — AI allocates everything, dispatcher monitors via oversight dashboard and intervenes when needed

**ML training:**
- Historical allocation patterns feed the model
- Dispatcher overrides are training signals (why was the AI's recommendation rejected?)
- Outcome correlation: which allocations led to on-time completion, efficiency, customer satisfaction
- Model improves over time per tenant

**Oversight dashboard (for Level 2+):**
- All auto-allocated jobs visible with AI reasoning
- Confidence scores per allocation
- Override capability at any point
- Metrics: auto-allocation accuracy, override rate, efficiency gains

### 5. Natural Language Queries

Users ask questions about their data in plain English.

**Example queries:**
- "How many loads did we do for Acme last month?"
- "What's our average margin on tonnage jobs this quarter?"
- "Which drivers have done the most loads at Henderson Quarry?"
- "Show me all jobs for Smith Transport that are overdue"
- "What's our revenue this week compared to last week?"

**How it works:**
- AI translates the natural language query into a database query
- Results are formatted as a readable response with supporting data
- Charts or tables generated where appropriate
- Query history for quick re-runs
- Suggested follow-up queries based on results

**Safety:**
- Read-only queries only — AI cannot modify data through this interface
- Queries scoped to tenant data (multi-tenant isolation enforced)
- Query complexity limits to prevent expensive operations
- Results respect user permissions (a user without financial access doesn't get margin data)

### 6. Proactive Suggestions

AI observes patterns and suggests actions before the user thinks to ask.

**Job creation suggestions:**
- "You usually schedule 3 trucks for this customer on Mondays — create recurring?"
- "This job type typically includes a tip fee — add one?"
- "Acme's last 5 jobs used tonnage billing — apply the same?"

**Scheduling suggestions:**
- "Driver Smith is finishing at Henderson Quarry at 2pm — there's a 3pm job at nearby Pine Rivers. Assign?"
- "Truck ABC-123 is approaching its service interval — consider using DEF-456 instead"
- "Tomorrow's schedule has 2 unallocated jobs in the North zone — you have 3 drivers finishing early in that area today"

**Financial suggestions:**
- "Customer XYZ's rates haven't been reviewed in 6 months"
- "Margin on this job type has dropped 5% this quarter — worth reviewing pricing?"
- "Contractor ABC has 3 unpaid RCTIs — may affect relationship"

**How it works:**
- Background analysis of patterns, trends, and upcoming events
- Suggestions surfaced as non-intrusive notifications (dismissable)
- Tenant controls which suggestion types are active
- Suggestions improve with usage (dismissed suggestions are deprioritised)

### 7. AI Document Analysis

Beyond docket OCR, AI can analyse documents for broader purposes.

**Capabilities:**
- Extract key terms from contracts and agreements
- Summarise lengthy documents (transport management plans, site safety plans)
- Compare document versions and highlight changes
- Identify missing or incomplete information in uploaded compliance documents

### 8. AI Communication Drafting

AI assists with drafting communications (doc 13).

**Capabilities:**
- Draft customer emails based on context (quote follow-up, invoice reminder, dispute response)
- Draft SMS messages with appropriate brevity
- Suggest notification content for non-standard events
- Tone adjustment (formal for customers, casual for internal)
- User always reviews and edits before sending — AI drafts, human sends

## Automation Engine

### BullMQ Job Queue

All background automation runs on BullMQ (Redis-backed), replacing Nexum's ad-hoc background tasks.

**Why BullMQ:**
- Reliable: jobs persist through server restarts
- Retryable: failed jobs retry with exponential backoff
- Monitorable: queue dashboard shows pending, active, completed, failed jobs
- Scalable: multiple workers can process queues in parallel
- Schedulable: cron-like scheduling for recurring tasks
- Already in the stack (Redis is used for WebSocket pub/sub and caching)

**Queue types:**
- `email` — Outbound email delivery with retry
- `notifications` — Push notification delivery
- `sms` — SMS delivery with provider failover
- `documents` — Document processing (image compression, PDF generation, S3 operations)
- `xero-sync` — Xero synchronisation operations
- `compliance` — Compliance status checks and SafeSpec data push
- `ai` — AI processing requests (job parsing, docket OCR, queries)
- `reports` — Report generation (background for large reports)
- `billing` — Batch invoice generation and billing runs
- `maintenance` — System maintenance (trash cleanup, storage tier transitions, cache invalidation)

**Monitoring:**
- Admin dashboard showing all queues, job counts, processing rates, failure rates
- Alert on queue backup (jobs not processing)
- Failed job inspection with error details and retry option

### Workflow Engine

A lightweight, tenant-configurable automation engine for business process automation.

**What it is:**
- Event-driven rules: "when X happens, do Y"
- Configurable by tenants in admin settings (no code required)
- Rules can be chained for multi-step workflows

**Event types (triggers):**
- Job status changes (created, scheduled, in_progress, completed)
- Docket/daysheet submitted or processed
- Invoice generated, sent, paid, overdue
- RCTI status changes
- Document uploaded or expiring
- Customer/contractor created or updated
- Compliance status changed (if SafeSpec connected)
- Time-based (daily at 6am, weekly on Monday, end of month)

**Action types:**
- Send notification (push, SMS, email — using doc 13 unified comms)
- Generate document (invoice, RCTI, statement, report)
- Update status (auto-transition job status based on conditions)
- Create task (assign a follow-up task to a user)
- Queue for review (add to an approval queue)
- Push data (send to Xero, SafeSpec, external webhook)
- AI action (run AI review, generate suggestion)

**Condition types:**
- Field value checks (amount > $5000, customer = "Acme", job_type = "Hourly")
- Time-based (overdue by 7 days, within 30 days of expiry)
- Count-based (more than 3 overages this month)
- Status checks (customer is on credit stop, asset is non-compliant)

**Example rules:**
- "When a job is completed AND customer billing is set to daily → auto-generate invoice"
- "When an invoice is 14 days overdue → send reminder email to customer"
- "When an invoice is 30 days overdue → send escalation notification to finance team"
- "When a daysheet is submitted AND all fields are within tolerance → auto-process"
- "When a contractor document is uploaded via portal → add to approval queue AND notify admin"
- "When a docket overage exceeds 5% → require manager approval before processing"
- "End of month → generate statements for all customers with outstanding balances"
- "Daily at 6am → send today's schedule summary to all dispatchers"

**Rule management:**
- Enable/disable individual rules
- Rule priority (when multiple rules match, priority determines order)
- Rule logging (every trigger and action recorded for audit)
- Test mode (simulate rule execution without performing actions)
- Templates for common workflows (tenant can enable pre-built rules)

### Built-in Automations

These always run (not tenant-configurable — they're core system behaviour):

**Compliance monitoring:**
- Document expiry alerts at configurable warning periods
- Escalating severity (info → warning → critical → expired)
- Entity status updates based on document validity

**Financial automation:**
- Auto-apply customer rate cards on job creation (DEC-072)
- Auto-apply fuel surcharges to applicable jobs (DEC-075)
- Minor overage auto-approval within tolerance (DEC-065)
- Payment sync from Xero (webhook + polling fallback)

**Data hygiene:**
- Trash auto-cleanup at 30 days
- Storage tier transitions
- Stale cache invalidation
- Orphaned file detection

**Notification delivery:**
- Email queue with retry
- SMS queue with provider failover
- Push notification delivery
- Failed delivery alerting

## Tenant Configuration

### AI Feature Toggles

Tenants control which AI features are active:
- AI Job Creation: on/off
- AI Job Review: on/off
- Docket OCR: on/off
- Smart Scheduling: on/off + level (0-3)
- Natural Language Queries: on/off
- Proactive Suggestions: on/off (per suggestion type)
- AI Document Analysis: on/off
- AI Communication Drafting: on/off

### AI Preferences

- Provider preference (if BYOK)
- Aggressiveness settings (how confident should AI be before auto-acting?)
- Suggestion frequency (how often to surface proactive suggestions)
- Auto-allocation confidence threshold (minimum score for auto-allocation)

### Automation Preferences

- Workflow rules managed in admin
- Built-in automation thresholds (warning periods, tolerance levels, retry counts)
- Notification preferences per automation type

## Permissions

- `ai.use` — Use AI features (job creation, review, queries, suggestions)
- `ai.manage` — Manage AI settings, provider keys, feature toggles
- `automation.view` — View workflow rules and automation logs
- `automation.manage` — Create, edit, enable/disable workflow rules
- `automation.admin` — Full automation control including built-in automation thresholds
