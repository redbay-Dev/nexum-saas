# 19 — Map & Planning

> Interactive map view, real-time GPS tracking, geofencing, route planning, backhaul detection, and region-based resource management.

## Overview

The map planner provides a geographic view of operations — where jobs are, where assets are in real-time, where backhaul opportunities exist, and how resources are distributed across regions. It integrates with the scheduler (doc 07) as a visual planning tool, not a separate planning system. Route awareness, backhaul detection, and real-time tracking feed into scheduling decisions and AI auto-allocation.

Google Maps is the map provider for display, directions, geocoding, and places.

## Interactive Map

### Map Display

Full-screen interactive Google Maps showing:
- **Job markers** — colour-coded by status (scheduled = green, in progress = blue, planning = orange, on hold = amber, completed = grey)
- **Marker icons** — P (pickup), D (delivery), S (site) with letters on markers
- **Route lines** — polylines between job locations with directional arrows
- **Asset markers** — real-time position of active vehicles (from DriverX GPS)
- **Region overlays** — coloured polygons showing geographic regions
- **Backhaul opportunities** — dotted lines showing potential return-leg jobs

### Map Layers (Toggleable)

- Traffic layer (live traffic conditions)
- Heatmap layer (job density/coverage)
- Route lines (show/hide)
- Asset positions (show/hide)
- Region overlays (show/hide)
- Backhaul opportunity lines (show/hide)

### Map Controls

- Map types: roadmap, satellite, hybrid, terrain
- Zoom and pan with auto-fit to visible markers
- Time filters: today, tomorrow, this week, custom date range
- Time block filters: AM (6am–12pm), PM (12pm–6pm), custom
- Status filters: multi-select by job status
- Region filters: show only jobs/assets in selected regions

### User Preferences

Per-user map preferences persist:
- Default zoom level and centre point
- Layer visibility defaults
- Filter presets
- Map style preference
- Window size and position (if opened separately)

## Real-Time GPS Tracking

### Live Vehicle Positions

DriverX (doc 20) sends live GPS coordinates from driver mobile devices. The map shows real-time vehicle positions.

**How it works:**
- DriverX sends GPS coordinates at configurable intervals (default every 30 seconds when active, every 5 minutes when idle)
- Coordinates push to the server via the DriverX API
- Server broadcasts position updates via WebSocket to map subscribers
- Map markers update in real-time without page refresh

**What the map shows:**
- Current position of each active vehicle
- Direction of travel (marker rotation)
- Speed indicator (if available from GPS)
- Driver name and asset details on hover/click
- Current job context (which job they're working on)
- Status indicator (en route to pickup, at site, en route to delivery, idle)

### Location History

Full GPS trail stored per driver session:
- Track routes taken throughout the day
- Playback feature — replay a driver's day on the map with timeline slider
- Trail overlay on map (toggle on/off per asset)
- Stop detection (where did the asset stop, for how long)
- Distance travelled calculation from actual GPS path (not just route estimates)

### Privacy & Control

- GPS tracking only active during working hours (configurable per tenant)
- Drivers see their own tracking status in DriverX
- Tracking data retained for configurable period (default 90 days)
- Tenant controls tracking frequency and retention
- GPS data is operational, not surveillance — used for dispatch efficiency and compliance

## Geofencing

### Site Geofences

Define geographic boundaries around operational sites (pickup locations, delivery sites, disposal sites, depots).

**How it works:**
- Admin draws a geofence boundary around a site on the map (circle with configurable radius or polygon)
- Geofence is linked to an address record
- When a DriverX device enters or exits the geofence, an event fires

**Automatic triggers on geofence events:**
- **Arrival at pickup:** Auto-update job status to "Loading" (or appropriate status)
- **Departure from pickup:** Auto-update to "In Transit"
- **Arrival at delivery:** Auto-update to "Unloading"
- **Departure from delivery:** Auto-complete the load/trip
- **Arrival at depot:** Mark driver as returned

**Configurable per site:**
- Geofence radius (default 200m, configurable per site)
- Which events trigger status updates
- Dwell time before triggering (avoid false triggers from passing near a site)
- Active hours (don't trigger outside operational hours)

### Geofence Benefits

- Reduces manual status updates — the system knows when a driver arrives and leaves
- Improves ETA accuracy (based on real departures, not estimated times)
- Compliance data — actual time at site for fatigue calculations
- Dispute resolution — GPS evidence of arrival/departure times
- Auto-timestamping of daysheet entries

## Route Planning

### Route Calculation

- Google Maps Directions API for route calculations between points
- Waypoint support for multi-stop routes
- Distance and duration estimates
- Polyline encoding for efficient map display
- Route caching (30-day TTL) to minimise API costs

### Route Optimisation

- Multi-stop route optimisation (reorder waypoints for shortest/fastest path)
- Factor in traffic conditions (departure time-based estimates)
- Alternative route suggestions
- Route comparison (distance vs duration trade-offs)

### Route Cost Tracking

- API usage tracked per tenant for cost transparency
- Route cache reduces API calls significantly
- Cost per route calculation available for pricing distance-based jobs

## Backhaul Detection

### Current Algorithm (Carries Forward)

Automatically detects return journey opportunities — unscheduled jobs near a primary job's return route.

**Scoring factors (0–100):**
- Revenue potential (0–30% weight)
- Time efficiency (0–25% weight) — ratio of job duration to detour time
- Proximity to route (0–20% weight) — distance from primary return route
- Material compatibility (0–15% weight)
- Time window fit (0–10% weight) — does the opportunity fit the schedule?

**Material compatibility rules:**
- Clean loads (sand, gravel, topsoil) — compatible with each other
- Dirty loads (demolition, contaminated) — needs cleaning before clean loads
- Wet loads (concrete, slurry) — incompatible with all others
- Same material type — always compatible

**Opportunity display:**
- High score (80+) — green, strong recommendation
- Medium score (60–79) — orange, worth considering
- Low score (<60) — red, marginal

### AI Enhancement

The backhaul algorithm is enhanced by AI (doc 16) that learns from dispatcher decisions:

**Learning signals:**
- Accepted opportunities — what made them attractive?
- Dismissed opportunities — why were they rejected?
- Patterns in acceptance by time of day, customer, material, driver
- Outcome tracking — did accepted backhauls complete successfully, on time?

**AI improvements over time:**
- Score weighting adjusts based on what dispatchers actually value
- Customer preferences learned (some customers are flexible on timing, others aren't)
- Driver familiarity factored in (drivers who know a site are more efficient)
- Traffic pattern awareness (a "quick detour" at 3pm rush hour isn't quick)
- Seasonal patterns (certain routes are busier at certain times of year)

**Proactive suggestions:**
- AI identifies backhaul opportunities before the dispatcher looks
- Surfaces in the scheduling view and map planner
- "Driver Smith is finishing at Henderson at 2pm — there's a 2:30 job at nearby Pine Rivers, 8 minutes detour"

## Region Management

### Region Definition

Geographic regions defined by suburb groupings:
- Each region contains an array of suburb names
- Regions have a unique colour for map display
- Map centre coordinates and default zoom level
- Active/inactive toggle

**Examples:** North Brisbane, South Brisbane, Gold Coast, Sunshine Coast, Lockyer Valley, Regional QLD, NSW

### Resource-to-Region Assignment

Drivers and assets can be assigned to regions:
- Primary region (home base)
- Secondary regions (can work there but not preferred)
- No region (available anywhere)
- Time-based assignments (seasonal, temporary)

### Region-Based Scheduling

Region assignments feed into the scheduler (doc 07) and AI allocation (doc 16):
- Same-region resources prioritised (+50 score in allocation algorithm)
- No-region resources neutral (+10 score)
- Different-region resources deprioritised (0 score)
- AI auto-allocation respects region preferences

### Region Analytics

- Job density by region
- Asset utilisation by region
- Coverage gaps (regions with high demand but low resource allocation)
- Cross-region job frequency (how often do resources work outside their region)

## Spatial Analytics

### Daily Overview Dashboard

- Total jobs by status
- Asset utilisation percentage
- Geographic coverage (unique suburbs covered)
- Time distribution (morning/afternoon split)
- Route efficiency trends
- Active assets vs total fleet

### Route Analytics

- Backhaul utilisation rate (opportunities detected, accepted, completed)
- Average detour distance and duration
- Score distribution across opportunities
- Route efficiency trends over time
- Job density heatmap by area

### Geographic Metrics

- Coverage zone analysis (which areas are well-served, which are underserved)
- Hotspot identification (top 5 busiest areas)
- Jobs per asset by region
- Travel time vs productive time ratios
- Distance analysis (average km per job, per day, per driver)

## Export

- Export map view as image (screenshot)
- Export job list with coordinates as CSV
- Export route analytics as PDF/CSV
- Export GPS trail data as CSV (for compliance or external analysis)

## Sidebar & Job Detail

### Map Sidebar

Left panel alongside the map:
- Filterable job list for the selected date/range
- Quick stats (job counts by status, asset counts)
- Backhaul opportunity cards (when detected)
- Region filter toggles

### Job Detail Panel

Click a job marker to see:
- Job number, customer, status
- Pickup and delivery locations
- Materials and quantities
- Allocated assets and drivers
- Scheduled time and ETA
- Quick actions: open job, view in scheduler, navigate to

### Asset Detail Panel

Click an asset marker to see:
- Asset registration, type, current driver
- Current job and status
- Today's schedule (remaining jobs)
- Location history trail (toggle)
- Quick actions: open asset, view schedule
