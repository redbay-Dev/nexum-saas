# 20 — DriverX

> React Native mobile app for drivers — job execution, GPS tracking, load capture, pre-starts, timesheets, and a full driver hub.

## Overview

DriverX is a native mobile app (React Native) for company drivers and contractor drivers. It's the driver's primary interface for everything work-related — from receiving job allocations and capturing loads to reviewing timesheets, managing leave, and viewing compliance status. Native because drivers need offline capability, GPS, push notifications, and camera access that web apps can't reliably provide from a truck cab.

DriverX is a **separate repository** from the Nexum monorepo. It consumes the Nexum API as an external client with its own release cycle. Shared types and validation schemas are published as a package that both repos consume.

## Authentication

- Drivers log in via Better Auth (same auth system as the web app)
- Biometric login (fingerprint/face) after initial credential setup
- Session persists until explicit logout or admin termination
- Push notification token registered on login
- Tenant context determined by the driver's linked company

## Core Features

### Job List & Schedule

The home screen shows the driver's work:

**Today's jobs:**
- Ordered by scheduled time
- Status indicators (upcoming, in progress, completed)
- Customer name, pickup/delivery locations, material type
- Tap to expand for full details

**Schedule overview:**
- Week view showing upcoming jobs by day
- Swipe between days
- Unconfirmed allocations flagged (waiting for driver acknowledgement)

**Job detail:**
- Full job information: customer, locations, materials, quantities, requirements
- Entry point details with GPS coordinates and instructions
- Special notes and site requirements
- Vehicle restrictions
- Contact details (site contact, dispatcher)
- Navigate button (opens native maps app with destination)

### Job Execution Flow

1. **Acknowledge allocation** — Driver confirms they've seen the job (optional per tenant)
2. **Start job** — Tap to start. Clock event recorded. GPS captured. Status → In Progress
3. **Capture loads:**
   - For each trip/load within the job:
   - Material and quantity (pre-populated from job, editable)
   - GPS at pickup (auto-captured)
   - GPS at delivery (auto-captured)
   - Weighbridge docket photo (camera capture)
   - Weighbridge docket number (manual entry or AI OCR from photo)
   - Time logged automatically (loaded, delivered)
   - Driver notes per load
4. **Digital signature** — Capture customer/receiver signature on screen with name and company
5. **Complete job** — Tap to complete. Clock event recorded. GPS captured. Status → Completed

Geofencing (doc 19) can automate steps 2 and 5 — arrival/departure triggers status changes without driver taps.

### Load Capture (Docketless System)

The load entry system replaces paper dockets for real-time digital capture:

- Each load is a separate entry with its own GPS, timestamps, and quantities
- Multi-load jobs show running totals (loads completed, tonnes delivered, etc.)
- Load list scrollable with edit capability (fix a mistake before sync)
- Photo capture for each load (weighbridge ticket, delivery evidence)
- AI OCR reads weighbridge photos and pre-fills weight fields (doc 08)
- Confidence indicators on AI-read fields — driver confirms or corrects

### GPS Tracking

DriverX provides GPS data for real-time tracking (doc 19):

- Continuous GPS reporting at configurable intervals (30 seconds active, 5 minutes idle)
- GPS captured at key events: job start, each load pickup/delivery, job complete
- Location sent to server via API, broadcast to map via WebSocket
- Battery-aware: reduces frequency when battery is low
- Privacy: tracking only during working hours (configurable per tenant)
- Driver sees their own tracking status (active/paused indicator)

### Pre-Start Checklists

Simple pass/fail vehicle inspection before each shift:

- Driver opens pre-start for their assigned asset
- Checklist items defined by SafeSpec (rendered dynamically in DriverX)
- Each item: check off (pass) or report defect
- Defect reporting: description + photo (camera capture) + severity (minor/major/critical)
- Critical defects flag the asset as requiring attention before use
- Completed pre-start submitted to Nexum → forwarded to SafeSpec for processing (DEC-099)
- Pre-start status visible to dispatch (completed/not completed/defect reported)

If SafeSpec is not connected, pre-starts still capture locally but without compliance processing.

### Clock Events & Timesheets

Real-time time capture throughout the day:

**Clock events:**
- Clock in (start of shift)
- Clock out (end of shift)
- Break start / break end
- Each event captures: timestamp, GPS location, linked job (if applicable), linked asset

**Timesheet review:**
- Driver can review their timesheet for the current week
- See classified hours: ordinary, overtime tier 1, overtime tier 2, weekend, public holiday
- See break durations
- See travel time vs productive time
- Flag discrepancies for review ("I was on-site from 6am but the system shows 6:15")
- Submit timesheet for approval (if tenant requires driver sign-off)

Clock events feed directly into the timesheet system (doc 03, DEC-066).

### Digital Signatures

Capture proof-of-delivery/pickup signatures on the device screen:

- Signer draws signature on touch screen
- Captures: signer name, role, company, timestamp, GPS location
- Linked to specific job and load
- Stored as image data, synced to backend
- Available on daysheet records as proof of work

## Driver Hub Features

### Messaging

Two-way communication with dispatch:

- Message thread per job (context-specific)
- General message thread with dispatch (not job-specific)
- Push notification on new messages
- Photo attachment support (send site photos, issues)
- Read receipts
- Message history scrollable

### Notification Centre

Central place for all notifications:

- New job allocations
- Schedule changes (time, location, or asset changes)
- Pre-start reminders (configurable time before shift)
- Compliance expiry alerts (licence, medical approaching expiry)
- RCTI/payment notifications (for contractor drivers, if contractor enables)
- System announcements from tenant
- Tap notification to navigate to relevant screen

### Leave Requests

Drivers can request leave through the app:

- Select leave type (annual, sick, personal, unpaid)
- Select dates (single day or range)
- Add notes
- Submit → goes to tenant for approval
- See request status (pending, approved, declined)
- See leave balance (if tenant provides this data)

### Qualification & Document Uploads

Drivers manage their own documents:

- View current documents and their status (valid, expiring, expired)
- Upload renewed documents (camera capture or file picker)
- Uploads go through the portal document approval workflow (doc 14, DEC-114)
- See approval status (pending, approved, rejected with reason)
- Expiry reminders prompt upload before documents expire

### Compliance Status

If SafeSpec is connected, drivers see their compliance status:

- Overall status: compliant (green), warning (amber), non-compliant (red)
- Per-item breakdown: licence, medical, qualifications, training
- Days until next expiry
- Action items (what needs attention)
- Non-compliant status explained in plain language ("Your medical certificate expires in 5 days — upload renewed certificate")

Without SafeSpec, drivers see document expiry status from Nexum's tracking.

### Training Records

View training and qualification history:

- List of qualifications with status and expiry
- Training records (completed courses, inductions)
- Upcoming training requirements
- Site-specific inductions completed

## Offline-First Architecture

DriverX is built for offline operation — drivers work in areas with poor or no mobile coverage.

### How Offline Works

- All data entry works without internet connection
- Job details, schedules, and checklists cached locally on device
- Load entries, clock events, GPS logs, signatures, photos all stored locally first
- Sync queue manages upload when connection returns

### Sync Mechanism

- On connection: queued items batch-uploaded to Nexum API
- Each record has a `synced` flag (true/false) and `sync_error` field
- Failed syncs retry with exponential backoff
- Sync conflicts resolved by server (server is source of truth for job data, driver is source of truth for captured data)
- Silent push notifications trigger background sync when data is waiting server-side

### What's Cached Locally

- Today's and tomorrow's job details (refreshed on each sync)
- Driver's schedule for the current week
- Pre-start checklist templates
- Recent load entries (for review/edit before sync)
- Message history
- Notification history
- Compliance status snapshot

### Offline Indicators

- Clear indicator when device is offline ("Working offline — data will sync when connected")
- Pending sync count visible (e.g. "3 items waiting to sync")
- Last successful sync timestamp
- Manual sync trigger button

## API Contract

DriverX communicates with Nexum's Fastify backend via REST API.

### Key Endpoints

**Authentication:**
- `POST /auth/login` — Better Auth login
- `POST /auth/biometric` — Biometric token verification
- `POST /auth/push-token` — Register push notification token

**Jobs:**
- `GET /driver/jobs` — Today's jobs and upcoming schedule
- `GET /driver/jobs/:id` — Full job detail
- `POST /driver/jobs/:id/acknowledge` — Acknowledge allocation
- `POST /driver/jobs/:id/start` — Start job (with GPS)
- `POST /driver/jobs/:id/complete` — Complete job (with GPS)

**Loads:**
- `POST /driver/jobs/:id/loads` — Submit load entry
- `PUT /driver/loads/:id` — Update load entry
- `POST /driver/loads/:id/photo` — Upload docket photo

**GPS:**
- `POST /driver/gps/batch` — Batch GPS coordinates upload
- `POST /driver/gps/event` — Single GPS event (status change)

**Clock:**
- `POST /driver/clock` — Clock in/out/break events
- `GET /driver/timesheet` — Current week timesheet

**Pre-starts:**
- `GET /driver/prestart/template` — Get current checklist template
- `POST /driver/prestart` — Submit completed pre-start

**Signatures:**
- `POST /driver/signatures` — Submit digital signature

**Messages:**
- `GET /driver/messages` — Message threads
- `POST /driver/messages` — Send message
- `POST /driver/messages/:id/read` — Mark read

**Documents:**
- `GET /driver/documents` — My documents and status
- `POST /driver/documents` — Upload document

**Leave:**
- `GET /driver/leave` — Leave requests and balance
- `POST /driver/leave` — Submit leave request

**Sync:**
- `POST /driver/sync` — Batch sync of offline data
- `GET /driver/sync/pending` — Check for pending server-side data

### API Versioning

- API versioned via URL prefix: `/api/v1/driver/...`
- Breaking changes require new version
- Old versions supported for minimum 12 months after deprecation (aligned with main API versioning policy, doc 21)
- DriverX includes minimum API version check on startup (force update if API too old)

## Push Notifications

Native push via APNs (iOS) and FCM (Android):

- New job allocation
- Schedule change (time, location, asset)
- Job cancelled
- Message from dispatch
- Pre-start reminder (X minutes before scheduled start)
- Compliance expiry warning
- Leave request approved/declined
- System announcement

Push is the primary real-time channel for drivers (doc 13, DEC-106). SMS fallback for drivers without the app installed.

## App Updates

- Distributed via App Store (iOS) and Google Play (Android)
- Minimum version enforcement: server checks app version on API calls
- If below minimum version → forced update screen
- If below recommended version → update prompt (dismissable)
- Over-the-air updates for JS bundle changes (CodePush or similar) for non-native changes

## Platform Support

- iOS 15+ (covers ~95% of active iOS devices)
- Android 10+ (API level 29+, covers ~90% of active Android devices)
- Tablet support (responsive layout adapts to larger screens)
- Dark mode support (follows system preference)

## Permissions (Device)

DriverX requests the following device permissions:

- **Location** (always/when-in-use) — GPS tracking and geofencing
- **Camera** — Docket photos, document uploads, defect photos
- **Push notifications** — Job alerts, messages, reminders
- **Biometric** — Fingerprint/face login
- **Storage** — Offline data cache and photo storage

All permissions explained to the driver with clear reasons before requesting.
