# 07 — Scheduling

## Overview

The scheduler is where dispatchers allocate resources (assets, drivers, contractors) to confirmed jobs. It's the operational hub — the view the dispatch team lives in all day, making decisions about who goes where with what.

Nexum's current scheduler is table-based with tab-based date navigation, compliance gating on allocation, region-based asset recommendations, staggered arrival times, and real-time multi-user broadcast. The rebuild keeps the core allocation model but adds multiple view options (table and timeline), improved recommendation scoring with more factors, proper recurring schedules, visual double-booking warnings, and — critically — the foundation for AI-driven auto-allocation to reduce staffing requirements.

Route optimization and backhaul matching should be integrated into the scheduler directly (not a separate feature). The map/route planning tools from doc 19 feed into scheduling decisions — the scheduler is where those decisions are acted on.

## Scheduler Views

### Multiple view modes
The rebuild supports switchable view modes:

**Table view** — The data-centric view and primary working view for dispatchers. Two display modes within the table:

- **Line view** — One compact row per job. Shows key info at a glance: job number, customer, locations, status, allocation count.
- **Multi-line view** — Expanded view showing one row per assigned asset within each job. Shows each allocated resource with its driver, times, and status. This is essential when jobs have many allocations (some jobs have 1 truck, some have 300).

Both display modes carry forward from Nexum — they work well for different situations.

**Timeline/Gantt view** — A visual timeline showing resources as rows and time blocks across the day or week. Jobs appear as blocks on the timeline. Overlapping allocations are visually obvious. Drag-drop allocation possible. Better for spotting gaps, overlaps, and utilisation patterns.

Both views show the same underlying data. Changes in one view are reflected in the other in real-time.

### Search — app-wide principle
The scheduler needs extensive search, and this applies to the entire application, not just the scheduler. Every page should support searching by anything — partial word matching, searching across all visible and related fields. On the scheduler specifically, search should cover: job number, job name, customer name, project, locations (addresses, suburb, site name), materials, allocated asset registration/make/model, driver names, contractor names, special requirements, contact details. Partial match always — typing "smi" finds "Smith's Quarry".

### Grouping and filtering
Grouping by: customer (default), project, region, asset type, none (flat list).

Filtering by: status, priority, customer, project, region, asset type, allocation status (allocated/unallocated), date range.

### Saved views
Users save preferred view configurations (filters, grouping, column layout, view mode, display mode) as named views. One default per user. Per-user — each dispatcher has their own setup.

### Date navigation and windowing
Tab-based date navigation: today, tomorrow, yesterday, plus rolling forward window. Calendar picker for jumping to dates. Multi-day view for side-by-side comparison.

Clicking a date tab opens the scheduler for that date in a **new window** — the user can view the main application and a separate scheduling window simultaneously. This is how Nexum works and it's the right approach. Multiple scheduling windows can be open at once (e.g., today's schedule in one window, tomorrow's in another while planning ahead).

## Resource Allocation

### Allocation model
Three resource types can be allocated to jobs:

- **Asset** — A specific vehicle or piece of equipment
- **Driver** — A specific driver (usually paired with an asset)
- **Contractor** — A contractor company providing the resource

### Allocation flow
When a dispatcher allocates a resource to a job:

1. **Compliance check** — The system checks the resource passes all compliance gates (doc 04). If compliance fails, allocation is blocked with a reason.
2. **Asset requirement matching** — The asset's full category AND subcategory is matched to the job's asset requirements. This must be specific — a job requiring "2 Side Tippers" is not the same as "2 End Tippers" or "2 Body Trucks". Subcategories define the specific type of equipment needed (tipper type, trailer configuration, body style, etc.), and the allocation must match at the subcategory level, not just the category.
3. **Allocation record created** — The allocation is stored with: who allocated, when, which job, which resource, and optional scheduled arrival time.
4. **Job status update** — The job transitions to the appropriate status based on context. If the job is in "Confirmed" status and assets are allocated, it moves to "Scheduled". If the scheduled start time has already passed at the time of allocation, the job should transition to "In Progress" (or the appropriate active status) — not stay at "Scheduled" for a job that's already meant to be running.
5. **Real-time broadcast** — All connected users see the allocation immediately.
6. **Notifications** — If configured, the driver/contractor is notified of the assignment.

### Staggered arrival times
Large jobs may need assets arriving at different times (e.g., 5 trucks at 6am, 3 more at 8am, 2 more at 10am). Each allocation can carry its own scheduled arrival time, separate from the job's overall start time. This is essential for jobs with many assets — staggering prevents congestion at the pickup/delivery site.

### Deallocation
When a resource is removed from a job:

- A reason is captured (reassignment, no longer needed, compliance issue, etc.)
- The resource becomes available for other work
- Completed load count can be recorded (for partial completions)
- The deallocation is audited with timestamp and user

### Bulk allocation
Multiple resources can be allocated to a job in a single action. This is critical — jobs commonly require anywhere from 1 to 300 trucks. Allocating them one at a time would be impractical. Bulk allocation should support:

- Select multiple assets and allocate all to the same job in one action
- Apply staggered arrival times across the bulk allocation (e.g., first 10 at 6am, next 10 at 7am)
- Compliance checks run for each resource in the batch — failed resources are reported but don't block the rest

## Double-Booking and Conflict Awareness

### Assets can work multiple jobs
A single asset can be allocated to multiple jobs on the same day. This is correct behaviour — a truck might do a morning delivery and an afternoon disposal run.

### Visual warnings for overlapping allocations
When an asset is allocated to multiple jobs with overlapping time windows, the system shows a visual warning. The dispatcher can see: which other jobs this asset is on, the time windows, and whether there's a genuine conflict.

Warning, not a block. The dispatcher makes the operational call.

### Allocation count visibility
Each asset shows its current allocation count. An asset on 3 jobs today is more visible than one on 1 job, helping dispatchers balance workload.

## Smart Recommendations

### Multi-factor scoring
When allocating an asset to a job, the system recommends best-fit resources based on multiple factors:

**Region match** — Assets in the same region as the job score higher. No region assignment gets a moderate score. Different region scores lowest.

**Entity ranking** — Overall ranking score (0–100) based on historical performance, reliability, and dispatcher preference.

**Availability** — Fewer concurrent allocations = higher score. Available assets rank above already-allocated ones.

**Proximity** — Assets near the job's pickup location (based on last known position or current job location) score higher. Reduces empty running.

**Hours worked** — Assets approaching daily hour limits or fatigue thresholds score lower. Helps distribute work evenly.

**Maintenance proximity** — Assets approaching next scheduled maintenance score lower. However, this factor must be **overridable** — operational situations regularly require using an asset that's close to service. The recommendation can flag it, but the dispatcher (or AI allocator) can override based on the specific situation.

**Driver preference** — Customer or location has a preferred driver? Assets with that driver assigned score higher.

**Capability match** — Beyond category/subcategory: body type, payload capacity, equipment fitted (scales, tarps, etc.) against job requirements.

### Recommendation display
Ranked list of recommended assets for each unallocated job. Updates in real-time as allocations change.

### Scoring weights
Tenant-configurable weights per factor. Default weights provided, tenants adjust for their operation.

### Override on all recommendations
Every recommendation factor can be overridden. The system recommends, the dispatcher (or AI) decides. No recommendation should ever block an allocation — compliance gates are the only hard blocks.

## AI-Driven Auto-Allocation

### The vision: reduce staffing requirements
A key goal is for AI agents to take over routine allocation decisions, reducing the need for manual dispatching and potentially reducing staffing. The scheduler should be built with this in mind from the start.

### How AI allocation works
The same multi-factor scoring that drives recommendations becomes the basis for AI decision-making:

- **Auto-allocate mode** — For recurring or routine jobs, the system can automatically allocate resources based on the scoring model. The AI agent reviews the unallocated jobs, scores available resources, and makes allocations without human intervention.
- **Human review mode** — AI proposes allocations, a dispatcher reviews and approves or adjusts. Good for building trust in the system and for complex/unusual jobs.
- **Hybrid** — Routine jobs auto-allocate, flagged/unusual jobs go to human review.

### Machine learning and training
The scoring model should improve over time:

- **Historical patterns** — Learn from past allocation decisions. Which assets performed well on which routes/materials/customers? Which dispatcher decisions were changed (indicating a poor initial allocation)?
- **Feedback loop** — When a dispatcher overrides an AI recommendation, that's training data. Over time, the model learns the tenant's operational preferences.
- **Performance correlation** — Link allocation decisions to outcomes (on-time delivery, docket quantities, customer feedback, cost efficiency) to identify what makes a good allocation.

### Tenant control
The tenant controls the level of AI involvement:

- Fully manual (AI recommendations only)
- AI proposes, human confirms
- AI auto-allocates routine work, human handles exceptions
- Full auto-allocation with human oversight dashboard

This is a progressive feature — tenants start with recommendations and move toward auto-allocation as trust builds.

## Route and Backhaul Integration

Route optimization and backhaul matching are scheduling decisions, not separate features. The scheduler should integrate:

- **Route awareness** — When recommending assets, consider the route. An asset finishing a delivery near the next job's pickup is ideal.
- **Backhaul detection** — Identify opportunities where an asset returning empty could pick up a load on the way back. Flag these to the dispatcher or AI allocator.
- **Multi-stop optimization** — For jobs with multiple pickup/delivery locations, suggest optimal stop sequences.

The detailed route planning and map tools are covered in **doc 19 — Map Planning**, but the scheduler is where these insights are acted on.

## Recurring Schedules

### Proper recurring job creation
Recurring schedules that automatically create jobs on a pattern:

- **Recurrence patterns:** Daily, weekly (specific days), monthly (specific dates), custom
- **Job template:** Customer, job type, locations, materials, asset requirements, pricing
- **Default allocations:** Pre-set resources to allocate (e.g., "always assign Truck ABC-123 to the Monday quarry run")
- **Auto-creation:** Jobs created ahead of time (configurable lead time)
- **Override and skip:** Individual occurrences modifiable or skippable

### Templates for manual use
Saved job templates for manual application — "create a job like this one" without automatic recurrence.

## Multi-Day Job Scheduling

- Job date range (scheduled_start to scheduled_end) defines the span
- Assets allocated for specific days within the range
- Scheduler shows multi-day jobs on each day they span
- Staggered allocations vary by day (different assets on different days)

## Real-Time Multi-User Operation

### Broadcast system
Every allocation, deallocation, status change, and job update broadcasts to all connected users in real-time. The scheduler is a live, shared view.

### What updates in real-time
New allocations, deallocations, job status changes, asset availability changes, new jobs, compliance status changes — all reflected immediately across all open windows.

### Conflict resolution
First write wins. If two dispatchers allocate the same asset to different jobs simultaneously, the first succeeds. The second dispatcher sees the asset is now allocated via real-time broadcast.

## Compliance Integration

### Allocation gates
All compliance checks from doc 04 apply at allocation time. If compliance fails, allocation is blocked with a visible reason.

### Compliance override
Authorised users can create time-limited overrides for exceptional circumstances. Audited and visible on the allocation.

## What's Different from Nexum

| Aspect | Nexum | Rebuild |
|--------|-------|---------|
| View modes | Table only (line + multi-line) | Table (line + multi-line) + Timeline/Gantt |
| Search | Basic search | Extensive partial-match search across all fields (app-wide principle) |
| Windowing | Separate scheduling windows | Same — new windows for date tabs |
| Drag-drop | Click-based via modals | Drag-drop in timeline view, click in table |
| Double-booking | Allowed silently | Allowed with visual warning |
| Requirement matching | Category level | Category + subcategory (specific equipment type) |
| Status on allocation | Always → Scheduled | Context-aware: → Scheduled if future, → In Progress if past start time |
| Bulk allocation | Supported | Critical path — 1 to 300 trucks per job, staggered times across bulk |
| Recommendations | Region + ranking (2 factors) | Multi-factor with tenant-configurable weights, all overridable |
| AI allocation | None | Auto-allocate, human review, or hybrid modes with ML training |
| Route integration | Separate feature | Integrated into scheduler — route awareness, backhaul detection |
| Recurring schedules | Barely implemented | Proper auto-creation with templates |
| Real-time | Broadcast system | Same, web-native (WebSockets) |

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 2*
