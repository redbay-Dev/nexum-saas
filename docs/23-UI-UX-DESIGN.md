# 23 — UI/UX Design

> Navigation, layout patterns, component conventions, and interaction design for the Nexum web application.

## Design Principles

1. **Modern and polished** — Clean lines, refined spacing, subtle depth. Users spend all day in this app — it should look and feel premium. Not generic shadcn defaults — considered colour choices, thoughtful shadows, intentional typography. A step above.
2. **Desktop-app interactions** — Double-click to open records. Right-click context menus. Keyboard shortcuts. Feels like a native application, not a webpage.
3. **Dark mode from day one** — Both light and dark are first-class. Every component works in both. User chooses their preference or follows system setting.
4. **Data density with breathing room** — Compact where it matters (table rows, form fields) but not cramped. Enough whitespace between sections that the interface feels organized, not overwhelming.
5. **Consistent patterns** — Every list looks the same. Every form works the same. Every detail page follows the same layout. Learn once, use everywhere.
6. **Works on 20" monitors and laptops** — Design for 1280px minimum width. Looks great on 1920px+. Not designed for phones (that's DriverX).

## Screen Layout

### The Shell

```
┌───────┬─────────────────────────────────────────────────────┐
│       │  🔍 Search...                          🔔  [RS▾]  │  ← Top bar (48px)
│       ├─────────────────────────────────────────────────────┤
│  N    │                                                     │
│  E    │                                                     │
│  X    │                                                     │
│  U    │              Page Content                           │
│  M    │              (full width, full height)              │
│       │                                                     │
│ ───── │                                                     │
│ 🏠 Ho │                                                     │
│ 📋 Jo │                                                     │
│ 👥 En │                                                     │
│ 💰 Fi │                                                     │
│ 📅 Sc │                                                     │
│ 📄 Do │                                                     │
│ 🗺 Ma │                                                     │
│ 📊 Re │                                                     │
│       │                                                     │
│ ───── │                                                     │
│ ⚙ Set │                                                     │
└───────┴─────────────────────────────────────────────────────┘
  ~220px                    remaining width
```

### Left Sidebar

A collapsible sidebar with navigation items. The primary structural element of the app.

**Visual style:**
- Slightly different background from the content area — darker in light mode, lighter-dark in dark mode. Creates natural separation without a hard border.
- Smooth collapse animation. Collapsed state shows icons only (~60px wide). Expanded shows icon + label (~220px).
- Collapse toggle at the bottom of the sidebar, or triggered by a keyboard shortcut.
- Active item has a subtle highlighted background — clearly shows where you are.
- Hover state on items — gentle background shift.

**Sidebar sections:**

```
[Nexum logo / tenant name]

── Main ──
🏠  Dashboard
📋  Jobs
📅  Schedule
📄  Dockets

── Manage ──
👥  Customers
🤝  Contractors
🏭  Suppliers
🚛  Drivers
🚚  Assets
📦  Materials

── Finance ──
💰  Invoices
📑  RCTI
💲  Pricing

── Other ──
🗺  Map
📊  Reports
💬  Messages

── bottom ──
⚙  Settings
```

**Grouping:** Items are organized into logical groups with subtle section headers (small caps, muted colour). Groups keep the nav scannable even with many items.

**Collapsible groups:** The "Manage" and "Finance" groups can be collapsed to hide their children. State persisted per user. Power users who never touch Materials can collapse "Manage" to just show the header.

**Module & role visibility:** Items only appear if the tenant has the module enabled AND the user has permission. A dispatcher won't see Finance items. A tenant without map planning won't see Map. This keeps the nav clean — most users see 8-10 items, not 18.

**Badge counts:** Key items show a count badge — Jobs (active count), Dockets (unprocessed), Messages (unread). Subtle, not overwhelming.

**Responsive:**
- **1920px+:** Sidebar expanded by default.
- **1280–1919px:** Sidebar collapsed by default (icons only). Expands on hover or toggle.
- **1024–1279px:** Sidebar hidden. Hamburger menu in top bar to toggle.

### Top Bar

A slim bar across the top of the content area (not the sidebar).

**Left side:** Breadcrumbs or page title context. On list pages, this might be empty (the page speaks for itself). On detail pages: "← Customers / Farrell Transport".

**Right side:**
- Global search (`Ctrl+K`) — command palette style
- Notifications bell with unread count
- User avatar with dropdown (Profile, Theme toggle, Logout)

**Height: 48px.** Minimal — it's not a navigation bar, just utilities and context.

## Interaction Patterns

### Double-Click to Open

Table rows support **double-click to open** the detail page. This is the primary "open" gesture.

- **Single click** — selects the row (highlights it)
- **Double-click** — navigates to the detail/edit page
- **Checkbox click** — toggles multi-select without navigating
- Clicking a **linked name** (rendered as a text link in the name column) also opens on single click — an alternative path

### Right-Click Context Menu

Every table row has a **right-click context menu** with relevant actions.

**Standard context menu items (vary by entity):**
- Open
- Open in New Tab
- ─── (separator)
- Edit
- Duplicate
- ─── (separator)
- Change Status → (submenu)
- ─── (separator)
- Export as PDF
- View Audit Log
- ─── (separator)
- Archive / Delete

**Technical:** Custom context menu (not browser native). Keyboard-accessible via `Shift+F10` or Menu key. Arrow key navigation within the menu.

### Keyboard Shortcuts

- `Ctrl+K` — Global search / command palette
- `N` — New record (context-sensitive to current page)
- `Enter` on selected row — Open (same as double-click)
- `Delete` on selected rows — Archive (with confirmation)
- `Escape` — Close panel/dialog, deselect rows
- `Ctrl+S` — Save (in forms)
- `Ctrl+B` — Toggle sidebar
- `?` — Keyboard shortcuts help

## Page Types

### 1. List Page

The default view for most sections. A data table with a toolbar above it.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Customers                              [+ New Customer]   │  ← Page header
│                                                             │
│  🔍 Search...   [Status▾] [Role▾] [Region▾]   [Clear all] │  ← Filter bar
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ □  Name            ABN            Status    Phone ▾ │   │  ← Sticky header
│  ├─────────────────────────────────────────────────────┤   │
│  │ □  Farrell Trans   51 824 753..   ● Active  0412..  │   │  ← Double-click to open
│  │ □  Smith Haulage   23 456 789..   ● On Hold 0398..  │   │     Right-click for menu
│  │ □  Jones Quarries  98 765 432..   ● Active  0756..  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Showing 1–50 of 234                   [← Prev] [Next →]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Conventions:**
- **Page header:** Title left, primary action button right.
- **Filter bar:** Search + dropdown filters. Active filters as dismissible pills.
- **Table:** Full width. Compact rows (32-36px). Sticky header. Sortable columns.
- **Row interactions:** Single-click selects, double-click opens, right-click context menu.
- **Bulk actions:** When rows selected, a floating bar appears at bottom: "3 selected — [Export] [Archive] [Deselect]"
- **Empty state:** Helpful message + CTA button. No sad illustrations.
- **Loading:** Skeleton rows. Shell stays interactive.

### 2. Detail Page

Full page view of a single record. Accessed by double-clicking a row.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ← Customers                                               │  ← Back link
│                                                             │
│  Farrell Transport Pty Ltd              [Edit] [···]       │  ← Name + actions
│  ABN 51 824 753 556 · Customer, Contractor · Active        │  ← Metadata
│                                                             │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ Overview │ Jobs     │ Invoices │ Contacts │  ...        │  ← Tabs
│  ├──────────┴──────────┴──────────┴──────────┘             │
│  │                                                         │
│  │  [Tab content — cards, sub-tables, related data]        │
│  │                                                         │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Conventions:**
- **Back link:** "← Customers" — always shows the parent list.
- **Entity header:** Name prominent. Metadata subtitle. Actions on the right.
- **Tabs:** Overview first, then related data. Sub-tables in tabs also support double-click and right-click.
- **"···" overflow menu** for secondary actions (Archive, Export PDF, Audit Log).

### 3. Form (Create / Edit)

**Simple entities** (contacts, regions): Slide-over panel from the right (~480px wide). List stays visible behind overlay.

**Complex entities** (jobs, companies): Full page with sectioned form.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ← Jobs                                                    │
│                                                             │
│  New Job                              [Save Draft] [Create]│  ← Title + actions
│                                                             │
│  ┌──── Customer & Type ─────────────────────────────────┐  │
│  │  Customer *              Job Type *                   │  │
│  │  [Select customer...▾]   ○ Transport  ○ Earthworks   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──── Locations ────────────────────────────────────────┐  │
│  │  Pickup *                 Delivery *                  │  │
│  │  [Search address...▾]     [Search address...▾]        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ▸ Requirements & Notes                                     │  ← Progressive disclosure
│  ▸ Pricing                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Conventions:**
- **Two-column** for short fields, single column for long content.
- **Sections with headers.** Common fields expanded, advanced collapsed.
- **Save button always visible** in the header area — never scroll to find it.
- **`Ctrl+S`** saves from anywhere in the form.
- **Unsaved changes warning** on navigate-away.

### 4. Dashboard

Landing page after login. Role-specific widgets.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Good morning, Ryan                                         │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 12       │ │ 3        │ │ $45,230  │ │ 2        │      │  ← KPI cards
│  │ Active   │ │ Need     │ │ Unbilled │ │ Overdue  │      │
│  │ Jobs     │ │ Attention│ │ Revenue  │ │ Invoices │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ┌─── Needs Attention ──────────────────────────────────┐  │
│  │  ⚠ 5 daysheets awaiting review                       │  │
│  │  ⚠ 2 driver licences expiring within 30 days         │  │
│  │  ⚠ 1 asset with overdue service                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Recent Jobs ──────────────────────────────────────┐  │
│  │  (compact table of recent/active jobs)                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Role dashboards:** Dispatcher (jobs, scheduling), Finance (revenue, invoices), Compliance (expiring docs, non-compliant items), Admin/Owner (everything).

## Component Patterns

### Tables

- **Full width.** Compact rows (32-36px).
- **Sticky header.** Sortable (Shift+click for multi-sort).
- **Row hover** — subtle background shift. Cursor: pointer.
- **Double-click** opens. **Right-click** shows context menu.
- **Status badges** — coloured dot + label.
- **Column picker** — toggle visible columns.
- **Skeleton loading.** No full-page spinners.

### Buttons

- **Primary:** Filled, brand colour. Subtle shadow. One per section max.
- **Secondary:** Outlined. Supporting actions.
- **Ghost:** Text/icon only. Toolbar and tertiary actions.
- **Destructive:** Red. Always requires confirmation.

### Status Badges

| Colour | Meaning | Examples |
|--------|---------|---------|
| **Green** | Active / Complete / Paid | Active, completed jobs, paid invoices |
| **Blue** | In Progress / Info | In progress, sent, processing |
| **Amber** | Warning / Attention | On hold, expiring, overdue < 30 days |
| **Red** | Critical / Overdue | Overdue 30+ days, non-compliant, void |
| **Grey** | Inactive / Draft | Drafts, inactive, cancelled |

### Forms

- Labels above inputs. Required fields marked with *.
- Searchable combobox for lists > 10 items.
- Date picker: DD/MM/YYYY. Phone: auto-format on blur. Currency: right-aligned, $, 2dp.

### Notifications

- **Toasts:** Bottom-right, auto-dismiss 5s. For transient feedback (saved, created, sent).
- **Bell dropdown:** Persistent notifications needing attention. Unread badge.
- **Never toast an error that needs action** — show inline.

### Dialogs

- Centred modals. Confirmation for destructive actions only.
- Destructive button names the action: "Delete Customer" not "OK".

### Empty & Error States

- **Empty:** Helpful message + CTA button. No sad illustrations.
- **Error:** What happened + Retry button.

## Visual Design

### Brand Colours

Extracted from the Nexum logo (`public/logo.svg`):

| Token | Hex | Usage |
|-------|-----|-------|
| **Brand Primary** | `#005AD0` | Primary buttons, active nav states, links, focus rings |
| **Brand Primary Light** | `#3B82F6` | Hover states, lighter accents (dark mode primary may shift to this) |
| **Brand Primary Dark** | `#003D8F` | Pressed states, darker accents |
| **Logo White** | `#FFFFFF` | Logo text — the logo is designed for dark backgrounds |
| **Logo Grey** | `#D9D9D9` | Secondary logo element |

The logo is white text on dark with a blue accent slash. This means:
- The **sidebar is dark** in both light and dark mode — a dark sidebar is the logo's natural home and gives the app a professional, anchored feel. The logo sits at the top of the sidebar in white.
- In **light mode**, the content area is a warm off-white. The dark sidebar creates strong visual separation.
- In **dark mode**, the content area is dark grey. The sidebar is slightly darker than the content to maintain the same visual hierarchy.

### Theme

- **Light and dark mode from day one.** Both first-class. User preference or system setting. Every component tested in both.
- **Dark sidebar always.** The sidebar background is dark in both modes. This anchors the interface, gives the logo a consistent home, and provides clear separation between navigation and content.
- **Warm neutral palette.** Not cold greys. Slightly warm off-whites (light mode) and warm dark tones (dark mode).
- **Dark mode is not inverted light mode.** Reduced contrast, elevated surfaces for depth. Shadows become more subtle; borders and surface colours do the work instead.
- **Brand blue (`#005AD0`) used intentionally.** Primary buttons, active sidebar item, links, focus rings. Not splashed everywhere — it's an accent, not a theme.
- **Subtle depth throughout.** Soft shadows, gentle elevation on cards and popovers. Not flat, not skeuomorphic — refined.
- **CSS variables for all colours** via shadcn/ui's oklch tokens. Light/dark switching is a `.dark` class toggle on `<html>`. Sidebar has its own set of colour tokens (already supported by shadcn's sidebar component).

### Typography

- **Inter or system font stack.** Clean, professional, excellent at small sizes.
- **14px** body/tables. **13px** secondary. **12px** badges. **20-24px** titles.
- **Monospace** for formatted values: ABN, phone numbers, invoice numbers, job IDs.
- **Weights:** Regular (400) body, Medium (500) labels/headers, Semibold (600) titles. No bold (700).

### Spacing

- **Base unit: 4px.** All spacing in multiples: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Content padding: 24px. Card padding: 16px. Table cells: 8px horizontal, 4px vertical.
- Section gaps: 24px. Field gaps: 8px.

### Borders & Shadows

- **Borders:** 1px, light grey. Tables, cards, inputs.
- **Shadows:** sm (menus), md (cards, popovers), lg (modals).
- **Border radius:** 6px cards/buttons, 4px inputs/badges, 8px modals.

## Responsive

| Breakpoint | Sidebar | Content |
|-----------|---------|---------|
| **1920px+** | Expanded (220px) | Full layout, all columns |
| **1280–1919px** | Collapsed (60px, icons only). Expand on hover/toggle. | Standard layout |
| **1024–1279px** | Hidden. Hamburger toggle. | Compact, single-column forms |

## Portal UI

Same shell, simplified sidebar:

- **Contractor:** Dashboard, My Jobs, Payments, Documents, Profile
- **Customer:** Dashboard, Jobs, Invoices, Documents, Profile

Same components, same interactions, fewer sections.

## Settings & Admin

Accessed via user avatar dropdown or a "Settings" item at the bottom of the sidebar:

- My Profile
- Organisation Settings
- Users & Roles
- Integrations (Xero, SafeSpec)
- Billing
- Audit Log

Settings pages use a sub-navigation within the content area (vertical tabs or left list within the settings page).

---

*Status: Draft — awaiting review by Ryan*
*Created: 2026-03-20 | Session 2*
