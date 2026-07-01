
# ARTIC VMS — Full System Guidance Document

**Project:** ARTIC Vehicle Monitoring System (Fleet Management Platform)
**Author:** System Documentation
**Date:** July 2026
**Status:** Development Complete — Running Locally

---

## TABLE OF CONTENTS

1. What This System Does
2. System Architecture Overview
3. How Each Layer Works
4. The Database — Every Table Explained
5. The Backend API — Every Endpoint
6. The Frontend — Every Page Explained
7. Real-Time Communication (WebSocket + MQTT)
8. Authentication & Security
9. Alert Rules & Geofencing Engine
10. Technical Issues Encountered and How They Were Fixed
11. Known Limitations
12. How to Shift This System to a Production Server
13. Production Checklist
14. Environment Variables Reference

---

## 1. WHAT THIS SYSTEM DOES

ARTIC VMS is a full-stack, real-time fleet management platform. It is designed for
organizations that operate a fleet of vehicles — delivery trucks, city buses, company
cars, or any motorized vehicle — and need to monitor them from a central dashboard.

The system does the following:

- Tracks the real-time GPS position of every vehicle on a live map
- Receives sensor data from each vehicle: speed, fuel level, engine temperature,
  RPM, battery voltage, and odometer readings
- Automatically raises alerts when a vehicle breaks a rule — speeding, low fuel,
  engine overheating, or entering/exiting a restricted zone
- Lets fleet managers create virtual geographic boundaries (geofences) and get
  notified when a vehicle crosses them
- Manages drivers and links them to vehicles
- Provides historical charts of speed, fuel, and temperature per vehicle
- Shows an analytics dashboard with counts, charts, and summaries
- Supports multiple user roles with different permissions
- Pushes all live updates to the browser instantly without needing a page refresh

The system has three main parts: a browser dashboard (frontend), a server API
(backend), and a database. GPS devices on vehicles connect to the server over MQTT,
a lightweight protocol designed for IoT devices.

---

## 2. SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER (User)                         │
│  Next.js 14 Dashboard — React, TailwindCSS, Leaflet Maps   │
│  Connects to backend via HTTP (REST API) and WebSocket      │
└───────────────────────┬─────────────────────┬───────────────┘
                        │ REST API             │ WebSocket
                        │ (HTTPS port 4000)    │ (Socket.IO)
                        ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND SERVER                             │
│  Node.js + Express + TypeScript (port 4000)                 │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │  REST API    │  │ Socket.IO  │  │   MQTT Broker        │ │
│  │  (auth,      │  │ (real-time │  │   (Aedes, port 1883) │ │
│  │  vehicles,   │  │  push to   │  │   GPS devices        │ │
│  │  alerts,     │  │  browser)  │  │   connect here       │ │
│  │  fleets...)  │  └────────────┘  └──────────────────────┘ │
│  └──────────────┘                                           │
│  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │  Prisma ORM  │  │  Business Logic Services           │   │
│  │  (DB layer)  │  │  telemetry, alerts, geofences      │   │
│  └──────────────┘  └────────────────────────────────────┘   │
└──────────┬──────────────────────────┬────────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌───────────────────────┐
│   PostgreSQL 18  │      │       Redis 7          │
│   fleet_management│      │  (session cache,       │
│   database       │      │   rate limit counters) │
└──────────────────┘      └───────────────────────┘

           ▲
           │  MQTT (port 1883)
┌──────────────────────────────────────┐
│  GPS Devices / Vehicle Simulators    │
│  Each device authenticates with its  │
│  unique deviceToken and publishes    │
│  telemetry JSON every few seconds    │
└──────────────────────────────────────┘
```

**Data flow — what happens when a vehicle sends a GPS ping:**

1. The GPS device connects to MQTT broker on port 1883 using its `deviceToken` as password
2. Broker authenticates the token against the database — finds the vehicle
3. Device publishes a JSON payload to topic `artic/<vehicleId>/telemetry`
4. Backend processes the telemetry:
   a. Saves a new record to the `telemetry` table
   b. Updates the `last_locations` table with the latest position
   c. Updates the vehicle's status (ACTIVE / IDLE / OFFLINE)
   d. Checks all active alert rules — creates Alert records if thresholds crossed
   e. Checks all active geofences — creates GeofenceEvent if boundary crossed
   f. Broadcasts the update to all browser clients in the org via Socket.IO
5. The browser dashboard receives the Socket.IO event and updates the map pin
   without any page reload

---

## 3. HOW EACH LAYER WORKS

### 3.1 Frontend (Next.js)

Located in: `frontend/`

The frontend is a Next.js 14 application using the App Router. It runs on port 3000
in development and communicates with the backend exclusively through the REST API
and WebSocket. It never touches the database directly.

Key libraries used:
- **React Query** — fetches and caches API data, auto-refreshes every 30 seconds
- **Zustand** — stores the logged-in user and auth tokens in memory + localStorage
- **Socket.IO client** — maintains a persistent WebSocket connection for live updates
- **React-Leaflet** — renders the live map using OpenStreetMap tiles
- **Recharts** — draws the telemetry history charts
- **React Hook Form + Zod** — handles form validation
- **TailwindCSS** — all styling, uses a custom `brand` blue colour palette
- **react-hot-toast** — shows notification toasts
- **next-themes** — dark/light mode toggle

How authentication works in the browser:
1. User enters credentials on `/login`
2. Frontend POSTs to `/api/v1/auth/login`
3. Response returns `accessToken` (15-minute JWT) and `refreshToken` (7-day UUID)
4. Both tokens are stored in Zustand state which persists to `localStorage`
5. Every API request includes `Authorization: Bearer <accessToken>` header
6. When the access token expires, the axios interceptor automatically calls
   `/api/v1/auth/refresh` with the refresh token to get a new access token
7. The Socket.IO connection also passes the access token in the handshake

### 3.2 Backend (Node.js / Express)

Located in: `backend/`

The backend is a TypeScript Express application. It handles:
- All REST API routes (auth, vehicles, fleets, drivers, alerts, geofences, reports)
- Socket.IO server for real-time push to browsers
- An embedded MQTT broker (Aedes) that GPS devices connect to directly

Request lifecycle:
1. Request arrives → CORS check → Helmet security headers
2. Rate limiter checks (stricter on auth routes: 20 req/15min)
3. Route matched → `authenticate` middleware verifies JWT
4. `authorize` middleware checks the user's role has permission
5. Controller function runs → calls a service → calls Prisma
6. Response sent back as JSON

### 3.3 Database (PostgreSQL via Prisma)

Located in: `backend/prisma/schema.prisma`

Prisma is the ORM (Object-Relational Mapper). It:
- Defines the database schema in `schema.prisma`
- Generates a type-safe TypeScript client used in all backend code
- Manages migrations — every schema change creates a migration SQL file

The database name is `fleet_management` running on PostgreSQL 18 locally.

### 3.4 Cache (Redis)

Redis is used for:
- Custom rate limiting via `checkRateLimit()` in `utils/rateLimiter.ts`
- Future session caching (infrastructure is in place)

Redis runs on port 6379. The application starts and logs even if Redis is slow to
connect — the `lazyConnect: false` setting will retry automatically.

---

## 4. THE DATABASE — EVERY TABLE EXPLAINED

### organizations
Stores the top-level tenant. Everything in the system belongs to an organization.
In a multi-tenant deployment, different companies would each have their own org.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | "ARTIC Demo Organization" |
| slug | String (unique) | URL-safe identifier, e.g. "artic-demo" |
| email, phone, address | String? | Contact info |

### users
Platform users who can log in to the dashboard.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| email | String (unique) | Login email |
| passwordHash | String | bcrypt hash, cost factor 12 |
| role | UserRole | SUPER_ADMIN, ADMIN, FLEET_MANAGER, DRIVER, VIEWER |
| organizationId | UUID | Foreign key to organizations |
| lastLoginAt | DateTime? | Updated on each successful login |

### refresh_tokens
Stores active refresh tokens for the JWT rotation system.
When a user logs out, their token is deleted here — making it immediately invalid
even before it naturally expires.

### fleets
A fleet is a named group of vehicles. e.g. "Nairobi City Fleet", "Night Shift Fleet".
Each fleet can have a manager (a User) assigned to it.

### vehicles
The core entity. Each vehicle has:
- A `deviceToken` — a UUID used to authenticate the GPS device over MQTT
- A `status` — ACTIVE (moving), IDLE (engine on, not moving), OFFLINE, MAINTENANCE
- A `fuelCapacity` — used for fuel percentage calculations
- An optional link to a fleet and a driver

The `deviceToken` is the password the physical GPS device uses to connect to MQTT.
It can be regenerated from the dashboard (Settings → Vehicle Detail → Regenerate Token).

### drivers
A driver profile is linked to a User account (role=DRIVER). A driver can optionally
be assigned to one vehicle at a time. The assignment is exclusive — assigning a new
driver to a vehicle automatically unassigns the previous one.

### telemetry
Every GPS ping from every vehicle is stored here. This table grows continuously.
One row per ping. A busy fleet sending pings every 5 seconds generates:
- 12 rows/minute per vehicle
- 720 rows/hour per vehicle
- 17,280 rows/day per vehicle
- With 10 vehicles: ~172,800 rows/day

The table has a composite index on `(vehicleId, timestamp DESC)` for fast queries.

### last_locations
A single row per vehicle containing only the most recent GPS data. Used by the
live map endpoint so it doesn't need to scan the entire telemetry table.
This is an `UPSERT` — created on first ping, updated on every subsequent ping.

### alerts
Triggered alert events. Each alert has:
- A `type` (SPEEDING, LOW_FUEL, GEOFENCE_ENTRY, etc.)
- A `severity` (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- A `status` lifecycle: ACTIVE → ACKNOWLEDGED → RESOLVED
- The user who acknowledged it and timestamps for each state change

### alert_rules
The conditions that cause alerts to be generated. Each rule belongs to an org and
defines a type + threshold. Examples:
- SPEEDING: `{ "maxSpeed": 100 }` → triggers when vehicle speed > 100 km/h
- LOW_FUEL: `{ "minFuel": 15 }` → triggers when fuel % < 15%
- ENGINE_OVERHEAT: `{ "maxTemp": 105 }` → triggers when temp > 105°C
- BATTERY_LOW: `{ "minVoltage": 11.5 }` → triggers when voltage < 11.5V

### geofences
Polygon zones defined by a JSON array of `[lat, lng]` coordinate pairs.
The system uses a point-in-polygon ray casting algorithm to test if a vehicle
is inside or outside each zone.

### geofence_events
Log of every time a vehicle crosses a geofence boundary (ENTRY or EXIT).

---

## 5. THE BACKEND API — EVERY ENDPOINT

Base URL (local): `http://localhost:4000/api/v1`

All protected endpoints require: `Authorization: Bearer <accessToken>`

### Health Check (no auth)
```
GET /health
Response: { status: "ok", service: "artic-vms-backend", version: "1.0.0" }
```

### Authentication
```
POST /auth/login           Body: { email, password }
POST /auth/refresh         Body: { refreshToken }
POST /auth/logout          Body: { refreshToken }
GET  /auth/me              Returns current user profile
POST /auth/change-password Body: { currentPassword, newPassword }
```

### Organizations
```
GET /organizations/me      Get own org details
PUT /organizations/me      Update org (ADMIN+)
```

### Users
```
GET  /users                List all users in org
POST /users                Create user (ADMIN+)
PUT  /users/:id            Update user (ADMIN+)
```

### Fleets
```
GET    /fleets             List fleets with vehicle counts
POST   /fleets             Create fleet (ADMIN+)
PUT    /fleets/:id         Update fleet
DELETE /fleets/:id         Delete fleet (ADMIN+)
```

### Vehicles
```
GET    /vehicles           List vehicles — supports ?search=&status=&fleetId=&page=&limit=
GET    /vehicles/:id       Get vehicle with last location, driver, alert/telemetry counts
POST   /vehicles           Create vehicle (FLEET_MANAGER+)
PUT    /vehicles/:id       Update vehicle
DELETE /vehicles/:id       Delete vehicle (ADMIN+)
POST   /vehicles/:id/regenerate-token   Issue new deviceToken (ADMIN+)
```

### Telemetry
```
POST /telemetry/ingest/:token    Device submits telemetry — authenticated by deviceToken (NO JWT)
GET  /telemetry/locations        Latest position of all vehicles in org (for live map)
GET  /telemetry/:vehicleId       History — supports ?from=&to=&limit=
GET  /telemetry/:vehicleId/latest  Single most recent record
```

### Alerts
```
GET    /alerts                   List alerts — ?status=&severity=&vehicleId=&from=&to=&page=&limit=
PATCH  /alerts/:id/acknowledge   Mark as ACKNOWLEDGED
PATCH  /alerts/:id/resolve       Mark as RESOLVED
GET    /alerts/rules             List alert rules
POST   /alerts/rules             Create alert rule (FLEET_MANAGER+)
DELETE /alerts/rules/:id         Delete rule (ADMIN+)
```

### Drivers
```
GET   /drivers              List all drivers with vehicle assignment
POST  /drivers              Create driver + linked user account (FLEET_MANAGER+)
PATCH /drivers/:id/assign   Assign or unassign a vehicle { vehicleId: string | null }
GET   /drivers/:id/activity Last 7 days telemetry stats for the driver's vehicle
```

### Geofences
```
GET    /geofences            List all geofences with event counts
POST   /geofences            Create geofence (FLEET_MANAGER+)
PUT    /geofences/:id        Update geofence (toggle isActive, rename, etc.)
DELETE /geofences/:id        Delete geofence (ADMIN+)
GET    /geofences/:id/events Last 50 entry/exit events for a zone
```

### Dashboard
```
GET /dashboard/stats    Summary: vehicle counts by status, alert counts by severity,
                        5 most recent alerts — refreshed every 30s by the dashboard page
```

### Reports
```
GET /reports/trips           Vehicle activity in date range — max/avg speed, record count
GET /reports/alerts-summary  Alerts grouped by type and severity in date range
Both support: ?from=YYYY-MM-DD&to=YYYY-MM-DD
```

---

## 6. THE FRONTEND — EVERY PAGE EXPLAINED

### /login
The entry point. Uses `react-hook-form` with Zod schema validation.
On success, stores tokens in Zustand (persisted to localStorage).
Redirects to `/dashboard`. Shows demo credentials on screen.

### /dashboard
Main overview. Fetches `/dashboard/stats` every 30 seconds.
Shows: total vehicles, active alerts, fleet count, online rate (4 stat cards).
Vehicle status donut chart (green=active, yellow=idle, grey=offline).
Recent alerts feed showing the last 5 triggered alerts.

### /vehicles
Paginated table of all vehicles. Supports text search and status filter.
Each row links to the vehicle detail page. Edit and delete inline.
Add Vehicle opens a modal with all fields including fleet assignment.

### /vehicles/:id
Full detail page for one vehicle. Shows:
- 6 metric cards: speed, fuel, engine temp, engine state, heading, alert count
- Speed/Fuel/Temperature line chart (last 200 telemetry records, updates every 15s)
- Vehicle info (VIN, capacity, fleet, driver, device token truncated, registration date)
- Last known GPS coordinates

### /telemetry  (Live Map)
Split-panel view: vehicle list sidebar + Leaflet map.
Vehicle pins are colour-coded by status. Clicking a pin or sidebar item flies the
map to that vehicle. Clicking again deselects.
Positions update in real time via Socket.IO `telemetry:update` events without
any polling — the map moves as the vehicle moves.

### /alerts
Full alert list with filters for status and severity.
Real-time: new alerts arrive via Socket.IO and appear instantly at the top.
Each alert has Acknowledge (yellow tick) and Resolve (green X) action buttons.

### /drivers
Card grid — one card per driver showing name, license, expiry, and current vehicle.
Add Driver form creates both a User account and a Driver profile in one operation.
Assign Vehicle dropdown lets you link/change/remove a vehicle assignment.

### /geofences
Table of all defined zones. Toggle switch to enable/disable without deleting.
Add Geofence form accepts a name, description, and a JSON coordinate array.
Entry/Exit alert toggles per zone.

### /reports
Date range picker. Two charts side by side:
- Alerts by Type (stacked bar chart)
- Vehicle Activity table (telemetry record count + max speed per vehicle)

### /users
User management table (Admin only). Role badge colour-coded.
Add/edit users with role assignment and optional password setting.

### /settings
Two sections:
- Organization info display
- Alert Rules management (add/delete rules with threshold values)

### /profile
Personal account page. Update name and phone number. Change password form
with current password verification. Organization info read-only panel.

---

## 7. REAL-TIME COMMUNICATION

### 7.1 Socket.IO (Browser ↔ Server)

The frontend connects to Socket.IO immediately after login using the access token
in the handshake auth object. The server verifies the JWT and joins the socket to a
room named `org:<organizationId>`.

This means broadcasts are scoped — users from Organization A never see events from
Organization B. The server emits to `org:<id>` whenever:
- A new telemetry record is processed: `telemetry:update`
- A new alert is triggered: `alert:new`

The browser handles both:
- `telemetry:update` → updates the vehicle pin position on the live map
- `alert:new` → adds a notification to the bell icon counter, shows a toast, and
  invalidates the alerts query so the alerts page refreshes if open

A client can also subscribe to a specific vehicle's room:
```
socket.emit('subscribe:vehicle', vehicleId)   // join vehicle:<id> room
socket.emit('unsubscribe:vehicle', vehicleId) // leave vehicle:<id> room
```

### 7.2 MQTT (GPS Devices → Server)

MQTT is a publish-subscribe messaging protocol designed for IoT devices. It uses
very little bandwidth and works well on 2G/3G connections — ideal for GPS trackers.

The embedded Aedes MQTT broker listens on TCP port 1883.

**Device connection process:**
1. Device connects with `clientId = any-unique-id`
2. Username and password must both be set to the vehicle's `deviceToken`
3. The broker's `authenticate` callback queries the database: does this token exist?
4. If yes, the `vehicleId` is stored on the client object for later use
5. If no, connection is refused

**Topic structure:**
```
artic/<vehicleId>/telemetry
```

**Payload format (JSON):**
```json
{
  "latitude": -1.286389,
  "longitude": 36.817223,
  "speed": 67.4,
  "heading": 245.0,
  "fuelLevel": 54.2,
  "engineTemp": 91.0,
  "engineOn": true,
  "rpm": 2400,
  "odometer": 14523.8,
  "batteryVoltage": 13.9,
  "ignition": true
}
```

All fields are optional — the device can send only what its sensors support.

**Vehicle Simulator** (`npm run simulate`):
The simulator (`backend/src/utils/simulator.ts`) reads all non-decommissioned vehicles
from the database, connects each one to MQTT with its real deviceToken, and sends
telemetry every 5 seconds. Position walks randomly from Nairobi (lat -1.29, lng 36.82).
Speed varies between 0-130 km/h. Fuel decreases slowly. Engine temp oscillates.
This generates real data in the database and triggers the live map updates.

---

## 8. AUTHENTICATION & SECURITY

### JWT Access Tokens
- Algorithm: HS256 (HMAC-SHA256)
- Expiry: 15 minutes (configurable via `JWT_EXPIRES_IN`)
- Payload: `{ userId, email, role, organizationId }`
- Verified on every protected request by the `authenticate` middleware

### Refresh Tokens
- A UUID (not a JWT) stored in the `refresh_tokens` database table
- Expiry: 7 days
- On use: validates token exists, not expired, then issues a new access token
- On logout: deleted from database immediately
- On password change: all refresh tokens for the user are deleted
- This means changing your password immediately logs out all other sessions

### Password Storage
- bcrypt with cost factor 12 (approximately 250ms hash time on modern hardware)
- The raw password is never stored or logged anywhere

### Role-Based Access Control (RBAC)
The `authorize(...roles)` middleware checks `req.user.role` against an allowed list.

| Role | Can Do |
|---|---|
| SUPER_ADMIN | Everything — full system access |
| ADMIN | Manage users, vehicles, fleets, drivers, rules |
| FLEET_MANAGER | Create/edit vehicles, drivers, fleets, alert rules |
| DRIVER | View own data only |
| VIEWER | Read-only dashboard access |

### Security Headers (Helmet)
Every response includes:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS in production)

### Rate Limiting
- Auth endpoints: 20 requests per 15 minutes per IP
- All other API endpoints: 300 requests per minute per IP
- Uses `express-rate-limit` (in-memory, resets on server restart)

### CORS
Only the origin specified in `CORS_ORIGIN` environment variable is allowed.
Credentials (cookies, auth headers) are permitted.

---

## 9. ALERT RULES & GEOFENCING ENGINE

### Alert Rule Processing
After every telemetry record is saved, `checkAlertRules(vehicleId, data)` runs:
1. Fetches all active rules for the vehicle's organization
2. For each rule, evaluates the condition against the telemetry values
3. If triggered, creates an Alert record in the database
4. Emits `alert:new` via Socket.IO to all browser clients in the org

Current supported rule types:
- `SPEEDING` — checks `data.speed > rule.conditions.maxSpeed`
- `LOW_FUEL` — checks `data.fuelLevel < rule.conditions.minFuel`
- `ENGINE_OVERHEAT` — checks `data.engineTemp > rule.conditions.maxTemp`
- `BATTERY_LOW` — checks `data.batteryVoltage < rule.conditions.minVoltage`

Each alert is only created once per telemetry event — the system does not deduplicate
(i.e., if a vehicle exceeds the speed limit on 100 consecutive pings, 100 alert records
are created). In production, you would add a "cooldown" mechanism — only trigger once
per X minutes per vehicle per alert type.

### Geofence Engine
After each telemetry record (if GPS data present), `checkGeofences(vehicleId, lat, lng)`:
1. Loads all active geofences for the organization
2. For each geofence, runs point-in-polygon ray casting to test if the vehicle is inside
3. Fetches the most recent geofence event for this vehicle+geofence pair
4. If vehicle just entered (was outside, now inside) → creates ENTRY event + optional alert
5. If vehicle just exited (was inside, now outside) → creates EXIT event + optional alert

The ray casting algorithm is O(n) where n is the number of polygon vertices — efficient
for typical geographic polygons with 4-20 vertices.

---

## 10. TECHNICAL ISSUES ENCOUNTERED AND HOW THEY WERE FIXED

This section documents every real issue that occurred during development and setup,
what caused it, and what the fix was.

---

### Issue 1 — Broken Template Literals Throughout Codebase
**Symptom:** Almost every backend and frontend file had syntax errors. TypeScript
reported errors like "Cannot find name 'km'" or "Expression expected" on format
strings. The code would not compile.

**Root Cause:** The original source files stored template literals (backtick strings)
as plain text without the backtick character. For example, what should have been
`\`Vehicle speed ${speed} km/h\`` was stored as plain broken text.

**Files affected:** 80+ files including all controllers, services, components, and pages.

**Fix:** Every broken string was manually reconstructed with correct JavaScript
template literal syntax using backticks and `${}` interpolation.

---

### Issue 2 — UTF-8 BOM on Every Single Source File
**Symptom:**
- Prisma schema: `Error code: P1012 — This line is invalid, does not start with any known Prisma schema keyword` (on line 1 — `generator client`)
- frontend `package.json`: `SyntaxError: Unexpected token '' — not valid JSON`
- TypeScript files: various cascading parse errors

**Root Cause:** Every file written by the file-writing tool was saved with a UTF-8
Byte Order Mark (BOM) — three bytes `EF BB BF` prepended to the file content. This
is invisible in most editors but causes strict parsers (Prisma's WASM validator, Node's
JSON parser, TypeScript compiler) to reject the file because the first character is
not what they expect.

**How BOM was detected:**
```powershell
$bytes = [System.IO.File]::ReadAllBytes("schema.prisma")
# First bytes were: EF BB BF — the UTF-8 BOM signature
```

**Fix:** A PowerShell script scanned every `.ts`, `.tsx`, `.json`, `.mjs`, `.css`,
and `.prisma` file in the project, detected if the first 3 bytes were `EF BB BF`,
and stripped them by writing back only `bytes[3..]`:
```powershell
[System.IO.File]::WriteAllBytes($path, $bytes[3..($bytes.Length-1)])
```
80 files were fixed in total. Files must always be written using
`[System.Text.Encoding]::UTF8.GetBytes()` + `WriteAllBytes()` to avoid BOM.

---

### Issue 3 — npm Install Failing with ENOSPC
**Symptom:** `npm error ENOSPC: no space left on device, write` during `npm install`
and `npx prisma generate`.

**Root Cause:** The C: drive had only 3.9 GB free. npm's default cache directory is
`C:\Users\<user>\AppData\Local\npm-cache` and npm writes packages there before
extracting them. The download itself plus extraction exceeded available space.

**Fix:** Redirect npm's cache and global prefix to the D: drive which had more space:
```powershell
npm config set cache "D:\npm-cache"
npm config set prefix "D:\npm-global"
npm cache clean --force
```
After this, all installs succeeded on D:.

---

### Issue 4 — Docker Desktop Not Running
**Symptom:** `unable to get image 'postgres:16-alpine': failed to connect to the
docker API at npipe:////./pipe/dockerDesktopLinuxEngine`

**Root Cause:** Docker Desktop application was installed but not started. The Docker
daemon needs Docker Desktop to be running (whale icon active in system tray) before
any `docker-compose` commands work.

**Fix:** Opened Docker Desktop from the Start menu, waited for it to fully initialise
(the taskbar whale icon stops animating), then re-ran `docker-compose up -d postgres redis`.
Both containers pulled and started successfully.

---

### Issue 5 — Two PostgreSQL Instances Competing on Port 5432
**Symptom:** `Error: P1000: Authentication failed` even though the Docker container
was running and the credentials were correct.

**Root Cause:** `netstat -ano` revealed two processes listening on port 5432:
- PID 8024: a local PostgreSQL 18 installation (pre-existing on the machine)
- PID 14656: Docker Desktop's proxy for the Docker postgres container

The local PostgreSQL 18 instance was intercepting connections first. It had no
`artic` user, so authentication failed with P1000 before the Docker container
ever received the connection.

**Fix:**
1. Used the local PostgreSQL 18 instance instead of Docker for the database
2. Connected as the `postgres` superuser (password `Artic$2026`)
3. Created the `fleet_management` database with `artic_user` as owner
4. Granted `CREATEDB` privilege to `artic_user` (needed for Prisma shadow DB)
5. Updated `DATABASE_URL` to use the correct database name and credentials
6. Updated `docker-compose.yml` to map Docker postgres to port 5433 to avoid
   future conflicts

---

### Issue 6 — `apexcharts` Peer Dependency Conflict
**Symptom:** `npm error ERESOLVE unable to resolve dependency tree` — `react-apexcharts@1.4`
requires `apexcharts@>=4` but `apexcharts@3.x` was declared in package.json.

**Root Cause:** The package.json listed `apexcharts: "^3.51.0"` and
`react-apexcharts: "^1.4.0"` — but react-apexcharts 1.4 upgraded its peer
dependency requirement to apexcharts 4.x.

**Further finding:** The codebase did not actually use apexcharts or react-apexcharts
anywhere in the code — the `TelemetryChart` component uses Recharts instead.

**Fix:** Removed both `apexcharts` and `react-apexcharts` from `package.json`.
This resolved the conflict and reduced bundle size.

---

### Issue 7 — `artic_user` Lacked CREATEDB Permission
**Symptom:** `Error: P3014 — Prisma Migrate could not create the shadow database.
Permission denied to create database.`

**Root Cause:** Prisma's `migrate dev` command creates a temporary "shadow database"
alongside the real one to calculate the diff between the current schema and the
database state. This requires the database user to have `CREATEDB` privilege.
`artic_user` was created without this privilege.

**Fix:**
```sql
ALTER USER artic_user CREATEDB;
```
After this, `npx prisma migrate dev --name init` ran successfully and created all
13 tables with proper indexes and foreign keys.

---

### Issue 8 — `prisma generate` Run from Wrong Directory
**Symptom:** `Error: Could not find Prisma Schema that is required for this command.
Checked: schema.prisma: file not found, prisma\schema.prisma: file not found`

**Root Cause:** The command was run from `d:\Projectts 2026\SANO IRENE\New folder (2)`
(the project root) instead of from the `backend/` subdirectory. Prisma looks for
`./prisma/schema.prisma` relative to the working directory.

**Fix:** Always `cd` to the `backend/` folder before running any `npx prisma` commands:
```powershell
cd "d:\Projectts 2026\SANO IRENE\New folder (2)\backend"
npx prisma generate
npx prisma migrate dev
npm run seed
```

---

## 11. KNOWN LIMITATIONS

These are things that work but could be improved before a production deployment:

### Alert Deduplication (No Cooldown)
Every telemetry ping that violates a rule creates a new Alert record. A vehicle
going 110 km/h and sending pings every 5 seconds will create 12 SPEEDING alerts per
minute. This floods the alerts table and notification feed.

**Recommended fix:** Add a cooldown — before creating a new alert, check if an alert
of the same type for the same vehicle already exists with status ACTIVE and was
triggered within the last N minutes (e.g., 10 minutes). If yes, skip creating a new one.

### Telemetry Table Growth
The telemetry table accumulates indefinitely. With 10 vehicles pinging every 5 seconds,
that is approximately 63 million rows per year.

**Recommended fix:** PostgreSQL table partitioning by month, plus a scheduled job
(pg_cron or a Node.js cron) that drops partitions older than 90 days.

### No Email/SMS Notifications
Alerts are only visible in the browser dashboard. There is no email or SMS sending.

**Recommended fix:** Integrate a service like SendGrid (email) or Africa's Talking
(SMS) in the alert creation service. Add a `notificationChannel` field to alert rules.

### Single Organisation
The seed creates one demo organisation. The system supports multi-tenancy at the
database level (every table has `organizationId`) but there is no UI to create or
manage multiple organisations.

### Redis Rate Limiting Resets on Restart
The rate limiter uses in-memory `express-rate-limit`. Custom Redis-based rate limiting
is wired up in `utils/rateLimiter.ts` but not yet connected to the main limiters.
This means rate limit counters reset every time the backend restarts.

### No HTTPS in Development
The development servers run plain HTTP. All data including passwords and tokens
are transmitted unencrypted in development. This is acceptable locally but must
never be deployed to a public server without HTTPS.

### Access Token in localStorage
The JWT access token is stored in Zustand state which persists to `localStorage`.
This makes it accessible to JavaScript, which creates an XSS risk. A more secure
approach is to store tokens in `httpOnly` cookies.

---

## 12. HOW TO SHIFT THIS SYSTEM TO A PRODUCTION SERVER

This section covers everything needed to deploy ARTIC VMS to a real internet-facing
server. Assume a Linux VPS (Ubuntu 22.04 LTS recommended) with a public IP address.

### 12.1 Server Requirements

Minimum specification:
- 2 vCPU cores
- 4 GB RAM
- 40 GB SSD storage
- Ubuntu 22.04 LTS
- Open ports: 80 (HTTP), 443 (HTTPS), 1883 (MQTT), 22 (SSH)
- A registered domain name (e.g., fleet.yourcompany.com)

Recommended for 50+ vehicles:
- 4 vCPU cores
- 8 GB RAM
- 100 GB SSD storage
- Separate managed PostgreSQL (e.g., AWS RDS, Supabase, Neon)

### 12.2 Install Server Dependencies

Connect via SSH, then:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install Certbot (free SSL from Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# Install PM2 (process manager for Node.js)
npm install -g pm2
```

### 12.3 Clone and Configure the Project

```bash
# Clone the repository
git clone https://github.com/your-org/artic-vms.git
cd artic-vms

# Configure backend environment
cp backend/.env.example backend/.env
nano backend/.env
```

Edit `backend/.env` with production values:
```
DATABASE_URL=postgresql://artic_user:STRONG_PASSWORD@localhost:5432/fleet_management?sslmode=require
REDIS_URL=redis://localhost:6379
JWT_SECRET=<random 64-character string — generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<different random 64-character string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=4000
MQTT_PORT=1883
NODE_ENV=production
CORS_ORIGIN=https://fleet.yourcompany.com
```

Configure frontend environment:
```bash
cp frontend/.env.local.example frontend/.env.local
nano frontend/.env.local
```
```
NEXT_PUBLIC_API_URL=https://fleet.yourcompany.com
NEXT_PUBLIC_WS_URL=wss://fleet.yourcompany.com
```

### 12.4 Start the Databases

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d postgres redis

# Wait for postgres to be ready, then run migrations
cd backend
npm install
npx prisma generate
npx prisma migrate deploy      # use deploy (not dev) in production
npm run seed                   # only needed on first deployment
```

### 12.5 Build and Start the Backend

```bash
cd backend
npm run build                  # compiles TypeScript to dist/

# Start with PM2 (keeps it running, auto-restarts on crash)
pm2 start dist/index.js --name artic-backend
pm2 save
pm2 startup                    # follow the printed command to auto-start on reboot
```

### 12.6 Build and Start the Frontend

```bash
cd frontend
npm install
npm run build                  # creates .next/ production build

# Start with PM2
pm2 start npm --name artic-frontend -- start
pm2 save
```

### 12.7 Configure Nginx as Reverse Proxy

Create the Nginx config:
```bash
sudo nano /etc/nginx/sites-available/artic-vms
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name fleet.yourcompany.com;

    # Frontend (Next.js on port 3000)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API (Express on port 4000)
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:4000/health;
    }
}
```

Enable and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/artic-vms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get free SSL certificate
sudo certbot --nginx -d fleet.yourcompany.com
```

Certbot will automatically update the Nginx config to redirect HTTP to HTTPS
and add the SSL certificate. It auto-renews every 90 days via a systemd timer.

### 12.8 Open MQTT Port in Firewall

MQTT devices connect on port 1883. Open it in the server firewall:
```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 1883
sudo ufw enable
```

If using a cloud provider (AWS, DigitalOcean, etc.), also open port 1883 in the
cloud firewall / security group settings.

### 12.9 Configure GPS Devices to Point at the Server

On each physical GPS device, configure:
- MQTT server address: `fleet.yourcompany.com`
- MQTT port: `1883`
- Username: the vehicle's `deviceToken` (copy from Vehicle Detail page)
- Password: the vehicle's `deviceToken` (same as username)
- Topic: `artic/<vehicleId>/telemetry`
- QoS: 0 or 1

For MQTT over TLS (secure), use port 8883. This requires additional Nginx stream
proxy configuration or a dedicated MQTT broker like Mosquitto with certificates.

### 12.10 Set Up Database Backups

```bash
# Create daily backup script
sudo nano /etc/cron.daily/backup-artic-db
```
```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=/var/backups/artic
mkdir -p $BACKUP_DIR
docker exec newfolder2-postgres-1 pg_dump -U artic_user fleet_management \
  | gzip > $BACKUP_DIR/fleet_management_$DATE.sql.gz
# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```
```bash
sudo chmod +x /etc/cron.daily/backup-artic-db
```

For critical deployments, also configure offsite backups (S3, Backblaze B2, etc.).

---

## 13. PRODUCTION CHECKLIST

Use this checklist before going live. Every item marked CRITICAL must be done.

### Security
- [ ] CRITICAL — Change JWT_SECRET to a random 64-character string
- [ ] CRITICAL — Change JWT_REFRESH_SECRET to a different random 64-character string
- [ ] CRITICAL — Change all database passwords to strong unique values
- [ ] CRITICAL — Enable HTTPS with a valid SSL certificate (Certbot / Let's Encrypt)
- [ ] CRITICAL — Set NODE_ENV=production
- [ ] CRITICAL — Set CORS_ORIGIN to your exact frontend domain (not *)
- [ ] CRITICAL — Never commit .env files to Git (ensure .gitignore covers them)
- [ ] IMPORTANT — Change all default login passwords (admin@artic.io / Admin1234!)
- [ ] IMPORTANT — Disable or delete the simulator script from production
- [ ] IMPORTANT — Review rate limits for your expected traffic volume
- [ ] NICE TO HAVE — Use httpOnly cookies for tokens instead of localStorage
- [ ] NICE TO HAVE — Enable MQTT over TLS (port 8883)

### Infrastructure
- [ ] CRITICAL — Server has at least 4 GB RAM and 40 GB disk
- [ ] CRITICAL — PostgreSQL and Redis are running and accessible
- [ ] CRITICAL — Port 1883 is open for MQTT device connections
- [ ] CRITICAL — PM2 or equivalent process manager configured with auto-restart
- [ ] CRITICAL — Daily database backups configured and tested
- [ ] IMPORTANT — Nginx reverse proxy configured and tested
- [ ] IMPORTANT — SSL certificate installed and auto-renewing
- [ ] IMPORTANT — Server firewall enabled with only required ports open
- [ ] NICE TO HAVE — Set up monitoring (UptimeRobot, Datadog, etc.)
- [ ] NICE TO HAVE — Centralized log aggregation (Papertrail, Logtail, etc.)

### Application
- [ ] CRITICAL — Run `npx prisma migrate deploy` (not migrate dev)
- [ ] CRITICAL — Run `npm run build` for both backend and frontend
- [ ] CRITICAL — Run `npm run seed` once to create the initial admin account
- [ ] CRITICAL — Test login with the seeded credentials
- [ ] CRITICAL — Test that the Live Map page shows vehicle positions
- [ ] CRITICAL — Test that alerts appear when the simulator triggers them
- [ ] IMPORTANT — Create an organisation-specific admin user and delete the demo one
- [ ] IMPORTANT — Configure your real alert rules (speed limits, fuel thresholds)
- [ ] NICE TO HAVE — Set up telemetry data retention/archival policy

### DNS
- [ ] CRITICAL — DNS A record points your domain to the server's public IP
- [ ] CRITICAL — DNS has fully propagated (check with: nslookup fleet.yourcompany.com)

---

## 14. ENVIRONMENT VARIABLES REFERENCE

### Backend (`backend/.env`)

| Variable | Required | Example | Description |
|---|---|---|---|
| DATABASE_URL | YES | postgresql://artic_user:pwd@localhost:5432/fleet_management?sslmode=disable | Full Prisma connection string |
| REDIS_URL | YES | redis://localhost:6379 | Redis connection string |
| JWT_SECRET | YES | (random 64 chars) | Signs access tokens — keep secret |
| JWT_REFRESH_SECRET | YES | (different 64 chars) | Signs refresh tokens — keep secret |
| JWT_EXPIRES_IN | NO | 15m | Access token lifetime (15 minutes) |
| JWT_REFRESH_EXPIRES_IN | NO | 7d | Refresh token lifetime (7 days) |
| PORT | NO | 4000 | HTTP server port |
| MQTT_PORT | NO | 1883 | MQTT broker TCP port |
| NODE_ENV | YES | development / production | Controls logging and behaviour |
| CORS_ORIGIN | YES | http://localhost:3000 | Allowed browser origin for CORS |
| MQTT_HOST | NO | localhost | Used by the simulator only |

### Frontend (`frontend/.env.local`)

| Variable | Required | Example | Description |
|---|---|---|---|
| NEXT_PUBLIC_API_URL | YES | http://localhost:4000 | Backend REST API base URL |
| NEXT_PUBLIC_WS_URL | YES | ws://localhost:4000 | Backend WebSocket URL |

Note: In production, both variables change to use your domain with HTTPS/WSS:
```
NEXT_PUBLIC_API_URL=https://fleet.yourcompany.com
NEXT_PUBLIC_WS_URL=wss://fleet.yourcompany.com
```

---

## APPENDIX A — LOCAL DEVELOPMENT CREDENTIALS

These are the current local development credentials. Do not use in production.

**PostgreSQL (local install):**
- Host: localhost
- Port: 5432
- Database: fleet_management
- User: artic_user
- Password: Artic$2026

**Redis:**
- Host: localhost
- Port: 6379
- No password (development only)

**Application Login:**
- Admin: admin@artic.io / Admin1234!
- Manager: manager@artic.io / Manager1234!

**Backend API:** http://localhost:4000
**Frontend Dashboard:** http://localhost:3000

---

## APPENDIX B — USEFUL COMMANDS CHEAT SHEET

```powershell
# ── Start everything (run from project root) ──────────────────────────────────

# Start backend (Terminal 1)
cd "d:\Projectts 2026\SANO IRENE\New folder (2)\backend"
npm run dev

# Start frontend (Terminal 2)
cd "d:\Projectts 2026\SANO IRENE\New folder (2)\frontend"
npm run dev

# Start GPS simulator (Terminal 3 — optional, for testing)
cd "d:\Projectts 2026\SANO IRENE\New folder (2)\backend"
npm run simulate

# ── Database operations ───────────────────────────────────────────────────────

# Apply schema changes after editing schema.prisma
cd backend ; npx prisma migrate dev --name <description>

# Open visual database browser
cd backend ; npx prisma studio

# Re-seed demo data (safe to run multiple times — uses upsert)
cd backend ; npm run seed

# Regenerate Prisma TypeScript types after schema change
cd backend ; npx prisma generate

# ── Diagnostics ───────────────────────────────────────────────────────────────

# Test backend is running
Invoke-RestMethod http://localhost:4000/health

# Check what's on port 5432
netstat -ano | findstr ":5432"

# Check if BOM present in a file
$b = [System.IO.File]::ReadAllBytes("file.ts")
Write-Host "$($b[0].ToString('X2')) $($b[1].ToString('X2')) $($b[2].ToString('X2'))"
# If output is "EF BB BF" — BOM present. Strip with:
[System.IO.File]::WriteAllBytes("file.ts", $b[3..($b.Length-1)])

# Move npm cache to D: drive (if C: drive is full)
npm config set cache "D:\npm-cache"
npm config set prefix "D:\npm-global"
npm cache clean --force
```

---

*Document end — ARTIC VMS Full System Guidance*
*Last updated: July 2026*
