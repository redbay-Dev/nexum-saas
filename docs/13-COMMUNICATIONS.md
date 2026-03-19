# 13 — Communications

> How Nexum sends messages, notifications, and real-time updates across all channels — unified into a single communications service.

---

## Overview

Nexum's communications are rebuilt as a **unified communications service** — one system handling SMS, email, push notifications, and in-app notifications. Instead of separate services for each channel, a single service manages templates, delivery, tracking, and history across all channels.

The channel strategy is clear:

- **Push notifications** (browser + DriverX mobile) — Primary real-time channel for operational updates
- **SMS** — For drivers and contractors without app access, and critical operational messages
- **Email** — For formal communications only: invoices, statements, remittance advice, quotes, compliance alerts

The notification type system is rethought for web SaaS. The 31 types from Nexum carry forward conceptually, but the delivery architecture is redesigned around WebSockets, push notifications, and a unified queue.

---

## Unified Communications Service

### Single Service, Multiple Channels

All outbound communications flow through one service:

- **Template engine** — One template system for all channels (SMS, email, push, in-app)
- **Delivery queue** — Single queue with per-channel delivery handlers
- **Communication log** — Unified history of everything sent, across all channels
- **Tracking** — Delivery status, read receipts, failures — all in one place
- **Retry logic** — Channel-appropriate retry with exponential backoff

### Why Unified?

- One place to see all communications for a job, customer, or driver
- One template system to maintain (not three separate ones)
- One delivery tracking dashboard
- Easier to add new channels later (WhatsApp, in-app chat, etc.)

---

## Channel: Push Notifications (Primary Real-Time)

### Browser Push

For web app users (dispatchers, admin, finance):

- **Service worker** — Registers on first login, requests push permission
- **Real-time delivery** — Job updates, allocation changes, docket submissions, approvals needed
- **Action buttons** — Quick actions directly from the notification (approve, view, dismiss)
- **Badge count** — Unread count on browser tab
- **Offline queuing** — Notifications queued if user is offline, delivered when they reconnect

### Mobile Push (DriverX)

For drivers using the DriverX mobile app:

- **Platform-native** — APNs (iOS) and FCM (Android) via a push notification service
- **Job assignments** — New job allocated, schedule change, cancellation
- **Pre-start reminders** — Reminder to complete pre-start before shift
- **Message notifications** — New SMS/message in conversation thread
- **Silent push** — Background data sync triggers without visible notification

### WebSocket Connection

For real-time in-app updates (not push notifications — these are live data updates):

- **Persistent connection** — WebSocket between browser and server
- **Channels** — Subscribe to relevant data channels (job updates, scheduler changes, notification feed)
- **Reconnection** — Auto-reconnect with exponential backoff on disconnect
- **Heartbeat** — Keep-alive to detect stale connections
- **Multi-tab** — Shared connection across browser tabs where possible

WebSocket replaces Nexum's PostgreSQL NOTIFY approach. In a web SaaS, the server pushes data changes to connected clients via WebSocket. This powers:

- Real-time scheduler updates (another user allocates → you see it instantly)
- Job status changes propagating to all viewers
- Notification feed updates without polling
- Collaboration awareness (who's viewing/editing what — doc 06)

---

## Channel: SMS

### Provider Strategy

Standardise on 1–2 SMS providers instead of Nexum's 5. The provider abstraction remains (easy to swap), but the rebuild ships with:

- **Primary provider** — Selected based on Australian coverage, cost, and reliability (likely Twilio or Sinch)
- **Fallback provider** — Secondary provider for failover if primary is down

The provider factory pattern carries forward — a clean interface that any SMS provider can implement. Adding a new provider later is straightforward.

### SMS Features

**Conversations** — SMS threads linked to jobs with participants (drivers, contractors, contacts). Carry forward from Nexum.

**Template system** — Configurable SMS templates with variable substitution from job data:
- Job number, customer name, locations, materials, dates, times
- Driver name, asset details, contractor details
- Custom fields

**Reply parsing** — Automatic handling of inbound replies:
- Registration confirmation (rego number matching)
- Yes/no responses for confirmations
- Free-text replies stored in conversation thread

**Delivery tracking** — Per-message status (queued, sent, delivered, failed) with webhook callbacks from the provider.

**Cost tracking** — Per-message cost in AUD for billing awareness and budgeting.

**Daily limits** — Configurable per-user SMS send limits to prevent accidental bulk sending.

### SMS Use Cases

- Job allocation notifications to drivers/contractors
- Schedule changes and cancellations
- Customer notifications (job updates, ETA)
- Bulk SMS to all drivers on a job
- Mid-job updates and variation notifications (DEC-047)

---

## Channel: Email

### Formal Communications Only

Email is reserved for communications that need to be formal, documented, or include attachments:

- **Invoices** — Customer invoice with PDF and supporting documents
- **Statements** — Customer and contractor account statements (doc 10)
- **Remittance advice** — Contractor RCTI remittance with docket images (doc 10)
- **Quotes** — Customer quotes with PDF attachment
- **Credit alerts** — Credit limit warnings and over-limit notifications
- **Compliance alerts** — Document expiry warnings (when SafeSpec connected)
- **Portal credentials** — Login details for contractor/driver portal
- **Password resets** — Authentication emails

### Email Service

- **Provider** — Transactional email service (e.g. SMTP2GO, SendGrid, Postmark — selected for deliverability)
- **Queue-based** — All emails go through a delivery queue with retry logic
- **Staggered sending** — Configurable delay between emails to avoid rate limits (critical for batch remittance)
- **Retry** — Exponential backoff on failure (configurable max retries)
- **Status tracking** — Pending, sent, failed with error capture
- **HTML + text** — Both variants for compatibility
- **PDF attachments** — Support for invoice, statement, and remittance PDFs
- **Encrypted credentials** — API keys stored encrypted (AES-256-GCM)

---

## Notification Types

The notification system is rethought for web SaaS while keeping the operational categories from Nexum.

### Notification Categories

**Scheduling & Allocation:**
- Job needs allocation (unallocated past threshold)
- Job requires attention (missing driver, missing asset, missing PO)
- Duplicate booking detected (asset double-booked with overlapping times)
- Contractor unconfirmed (allocation pending contractor acceptance)
- Asset approaching maintenance (from SafeSpec, when connected)

**Job Lifecycle:**
- Job status changed (confirmed, started, completed, cancelled)
- Job issue reported (from driver via DriverX)
- Mid-job variation (pricing or scope change after confirmation)

**Accounts & Finance:**
- Job ready for invoicing (AR-approved)
- Docket pending verification
- Invoice overdue (past payment due date)
- RCTI pending approval
- Payment received (customer or contractor)
- Supplier invoice received (AP)

**Credit:**
- Credit warning threshold reached (e.g. 80%)
- Credit limit exceeded
- Credit stop applied/removed
- Over-limit approval requested

**Compliance (SafeSpec connected):**
- Entity approaching non-compliance (warning)
- Entity non-compliant (blocked)

**System:**
- System announcements
- Integration errors (Xero sync failure, SafeSpec connection issue)

### Notification Routing

Each notification type has a default channel routing:

| Category | Push | In-App | SMS | Email |
|----------|------|--------|-----|-------|
| Scheduling & Allocation | Yes | Yes | No | No |
| Job Lifecycle | Yes | Yes | Drivers via SMS | No |
| Accounts & Finance | Yes | Yes | No | Overdue only |
| Credit | Yes | Yes | No | Warning + exceeded |
| Compliance | Yes | Yes | No | Critical only |
| System | No | Yes | No | Errors only |

Users can customise their channel preferences per notification type. The routing table above is the default.

---

## User Notification Preferences

### Per-User Settings

Each user controls their notification experience:

- **Global toggles** — Enable/disable notifications entirely, per channel (push, in-app, email)
- **Per-type preferences** — Override channel routing for specific notification types
- **Quiet hours** — Suppress push and SMS during defined hours (email queued for later)
- **Snooze** — Temporarily mute specific notification types (e.g. snooze "job needs allocation" for 1 hour)

### Company-Wide Settings

Tenant admin controls:

- **Global delivery** — Enable/disable notification delivery for the company
- **Retention** — How long to keep notification history (default 90 days)
- **Default routing** — Override default channel routing for all users
- **SMS limits** — Daily send limits per user

---

## Templates

### Unified Template System

One template system serves all channels. Templates are tenant-configurable with system defaults.

### Template Structure

Each template has:

- **Name** — Human-readable identifier
- **Channel variants** — Different content per channel (SMS is short, email is formatted, push is brief)
- **Variables** — Placeholders replaced with real data: `{job_number}`, `{customer_name}`, `{driver_name}`, `{location}`, `{date}`, `{time}`, etc.
- **Trigger** — Which notification type or action triggers this template
- **Active** — Toggle on/off without deleting

### Channel-Specific Formatting

The same notification rendered differently per channel:

- **Push** — Title + short body (max ~100 chars). E.g. "Job #1234 allocated to you - Smith Quarry to Main St"
- **SMS** — Concise message (max 160 chars for single SMS). E.g. "FTG: Job 1234 allocated. Smith Quarry → Main St. 6:00am start. Reply YES to confirm."
- **Email** — Full HTML with branding, details, and links. Used only for formal communications.
- **In-app** — Title + body + action link. Displayed in notification dropdown.

### Template Preview

Before saving, users can preview templates with sample data to see exactly how they'll render in each channel.

---

## Communication Log

### Unified History

All communications are logged in one place:

- **Per entity** — View all communications for a customer, driver, contractor, or job
- **Per channel** — Filter by SMS, email, push, or in-app
- **Delivery status** — Sent, delivered, failed, read
- **Content** — What was sent (message body, template used)
- **Timestamp** — When sent and when delivered/read
- **Sender** — Which user or system triggered the communication

### Job Communication Timeline

Every job has a communication timeline showing all messages related to that job — SMS to drivers, emails to customers, push notifications to dispatchers, automated alerts. This gives a complete picture of who was told what and when.

---

## Automated Notifications

### Event-Driven

Notifications are triggered by system events, not polling:

- Job status changes → notify relevant parties
- Allocation created → notify driver/contractor
- Docket submitted → notify finance
- Invoice overdue → notify accounts + credit warning
- Payment received → update credit, notify accounts
- Compliance status changed → notify operations (via SafeSpec webhook)

### Polling for Time-Based Checks

Some notifications require periodic checking:

- Overdue unallocated jobs (check every 5 minutes)
- Overdue invoices (check every hour)
- RCTI pending approval (check every 30 minutes)

These run as background jobs (BullMQ per SafeSpec architecture) rather than in-process polling.

---

## Real-Time Architecture

### WebSocket for Live Data

The web SaaS uses WebSockets for real-time data propagation:

**Server → Client:**
- Job data changes (status, pricing, materials, locations)
- Scheduler updates (new allocations, changes, cancellations)
- Notification feed (new notifications, read status)
- Collaboration (who's viewing/editing)

**Client → Server:**
- Presence (user is active, viewing specific page)
- Typing indicators (for collaboration features)

### Channel Subscriptions

Clients subscribe to relevant channels:

- `jobs:{jobId}` — Updates for a specific job
- `scheduler:{date}` — Scheduler updates for a date
- `notifications:{userId}` — User's notification feed
- `company:{companyId}` — Company-wide broadcasts

### Scaling

WebSocket connections scale via Redis pub/sub (already in the stack via BullMQ). Multiple server instances share real-time events through Redis, ensuring all connected clients receive updates regardless of which server they're connected to.

---

## Key Decisions for This Document

| Decision | Summary |
|----------|---------|
| DEC-103 | Standardise on 1–2 SMS providers with provider abstraction for easy swapping |
| DEC-104 | Notification system rethought for web SaaS — WebSockets, push notifications, event-driven |
| DEC-105 | Unified communications service — single service for SMS, email, push, in-app with shared templates, queue, and history |
| DEC-106 | Push notifications are primary real-time channel, SMS for drivers/contractors without app, email for formal only |
| DEC-107 | WebSocket replaces PostgreSQL NOTIFY for real-time data propagation in web SaaS |
