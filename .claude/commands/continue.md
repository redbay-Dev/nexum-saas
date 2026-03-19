Resume development from where the last session left off. This command must give the user a COMPLETE and HONEST picture of project status — not a rosy summary.

## Steps

### 1. Assess Current State
- Read `CHANGELOG.md` — what was done recently, what was flagged as next
- Read `docs/DECISION-LOG.md` — recent decisions
- Run `git log --oneline -20` — recent commits
- Run `git status` and `git diff` — uncommitted work

### 2. Assess FULL Project Completion (CRITICAL)
Compare what exists in the codebase against ALL spec docs. Read each doc and check what's actually implemented vs what's missing:

**Foundation:**
- `docs/00-PROJECT-OVERVIEW.md` — overall product vision
- `docs/01-CORE-IDENTITY.md` — multi-tenancy, company model
- `docs/21-TECHNICAL-ARCHITECTURE.md` — infrastructure, stack, API design
- `docs/22-DEVELOPMENT-WORKFLOW.md` — conventions, testing, CI/CD, CLAUDE.md

**Business Entities:**
- `docs/02-BUSINESS-ENTITIES.md` — customers, contractors, suppliers, contacts, addresses
- `docs/03-DRIVERS-EMPLOYEES.md` — driver profiles, licences, qualifications
- `docs/04-ASSETS-FLEET.md` — vehicles, categories, mass limits, maintenance
- `docs/05-MATERIALS-DISPOSAL.md` — material types, pricing behaviour, disposal sites

**Operations:**
- `docs/06-JOB-SYSTEM.md` — job creation, lifecycle, workflow, projects
- `docs/07-SCHEDULING.md` — resource scheduling, allocation, conflict handling
- `docs/08-DOCKETS.md` — daysheets, dockets, charge creation
- `docs/09-PRICING-ENGINE.md` — pricing methods, rate cards, markup, margin

**Finance:**
- `docs/10-INVOICING-RCTI.md` — invoice generation, RCTI workflow, credits
- `docs/11-XERO-INTEGRATION.md` — OAuth, sync, webhooks

**Platform:**
- `docs/12-COMPLIANCE-SAFETY.md` — SafeSpec integration, compliance gates
- `docs/13-COMMUNICATIONS.md` — push/SMS/email, WebSocket, notifications
- `docs/14-PORTAL.md` — contractor/customer portal
- `docs/15-DOCUMENTS.md` — document management, S3/Spaces
- `docs/16-AI-AUTOMATION.md` — AI features, workflow engine
- `docs/17-REPORTING-ANALYTICS.md` — reports, scheduled delivery
- `docs/18-ADMINISTRATION.md` — permissions, roles, audit, onboarding
- `docs/19-MAP-PLANNING.md` — GPS, geofencing, route planning
- `docs/20-DRIVERX.md` — mobile app API contract

For each area, assess honestly:
- **Not started** — no code exists
- **Scaffolded** — basic structure exists but no real business logic or workflows
- **Partially complete** — some sub-features work but key parts missing
- **Complete** — all sub-features work as specified, with tests

### 3. Identify Half-Built Features
Look specifically for features that were "implemented" but are actually just thin CRUD without:
- The business logic specified in the docs (e.g., pricing calculations, margin checks, compliance gates)
- Sub-features listed in the spec (e.g., rate cards under pricing, credit holds under invoicing)
- Integration between features (e.g., scheduling using compliance status, invoicing using pricing engine)
- Required validation rules, calculations, or automation
- Tests (unit tests for business logic, integration tests for API routes)

### 4. Report to User
Present a clear, honest summary:

**Last session:** What was done (from CHANGELOG.md)

**Overall project completion:**
- Phase 1 (Scaffold): status
- Phase 2 (Database Foundation): status
- Phase 3 (Auth & Core API): status
- Business Entities (docs 02-05): status per area
- Operations (docs 06-08): status per area
- Finance (docs 09-11): status per area
- Platform (docs 12-20): status per area

**Half-built features that need finishing:**
- List features that exist but aren't production-ready

**Recommended next priority:**
- Based on the build order in INITIAL-AGENT-PROMPT.md (entities → drivers → assets → materials → jobs → scheduling → dockets → pricing → invoicing → Xero)
- Focus on DEEPENING existing features before adding new thin slices

### 5. Ask the User
Ask what they want to focus on, but suggest a specific plan based on the assessment. Default suggestion should be to FINISH incomplete features rather than start new ones.
