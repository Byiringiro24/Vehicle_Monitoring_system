# ARTIC VMS — Existing System Structure
**Document type:** Technical reference  
**Last updated:** October 2026  
**Live URL:** https://articvms.ddnsgeek.com  
**Repository:** https://github.com/Byiringiro24/Vehicle_Monitoring_system

---

## 1. SYSTEM OVERVIEW

ARTIC VMS is a multi-tenant fleet and business management platform. It runs as four Docker containers on a single Ubuntu 24.04 server. Traffic enters through Nginx (HTTPS) and is routed to either the Next.js frontend (port 3000) or the Node.js backend API (port 4000).

```
Browser / GPS Device
        │
   Nginx (443/80)
   ┌────┴─────────────────────────────────┐
   │ Frontend          Backend API        │
   │ Next.js :3000     Node.js :4000      │
   │                        │             │
   │                   PostgreSQL         │
   │                   Redis              │
   └──────────────────────────────────────┘
        │
   MQTT Broker :1883 (ESP32 GPS devices)
```

---

## 2. USER ROLES — WHO EXISTS IN THE SYSTEM

There are **6 user roles** stored in the `UserRole` enum in the database. Each role determines which pages are shown in the sidebar and which API operations are permitted.

### Role 1 — SUPER_ADMIN

**Who this is:** The platform owner — the person running the ARTIC VMS business itself.  
**How created:** Only via the database seed script. Cannot be registered through the web.  
**Default credentials:** admin@artic.io / Admin1234!

**What they can do:**
- See and manage ALL companies registered on the platform
- Approve or reject new company registrations
- Assign subscription plans to companies (Free, Starter, Business, Enterprise)
- Grant or revoke feature entitlements per company
- See all support tickets submitted by any user and reply to them
- Configure support contact links (WhatsApp, phone, email, Instagram, TikTok) that appear sitewide
- Force-reset any user's password
- See all users across all organizations
- Access platform-level analytics (total companies, users, vehicles, subscription status)

**Home page after login:** `/platform`  
**Sidebar shows:** Platform, Dashboard, Live Map, Vehicles, Drivers, Alerts, Geofences, Maintenance, Telemetry, Customers, Agreements, Finance, Reports, Documents, Users, Settings, Support

---

### Role 2 — ADMIN

**Who this is:** The company administrator — the person who registered their company on ARTIC VMS.  
**How created:** Created automatically when a company registers at `/register`. Also created manually by Super Admin.  
**Status flow:** When a company registers, the ADMIN starts as PENDING and cannot access the dashboard until Super Admin approves the registration.

**What they can do (after approval):**
- Everything a Fleet Manager and Finance Manager can do
- Add/edit/deactivate users in their organization
- Set alert rules (speed limits, fuel thresholds, etc.)
- View and edit organization settings
- View subscription plan and enabled features
- Manage team memberships

**Home page after login:** `/dashboard`  
**Sidebar shows:** All pages except Platform

---

### Role 3 — FLEET_MANAGER

**Who this is:** Staff member responsible for the vehicle fleet.  
**How created:** ADMIN creates their account from the Users page.

**What they can do:**
- View and manage all vehicles and drivers
- See the live GPS map and vehicle details
- Log maintenance records and view upcoming service schedule
- Acknowledge and resolve alerts
- Create and manage geofences
- Upload and verify vehicle/driver documents
- Create agreements with customers
- View fleet and vehicle reports

**Home page after login:** `/dashboard`  
**Sidebar shows:** Dashboard, Live Map, Vehicles, Drivers, Alerts, Geofences, Maintenance, Telemetry, Customers, Agreements, Documents, Reports, Settings, Support

---

### Role 4 — FINANCE_MANAGER

**Who this is:** Staff member responsible for financial operations.  
**How created:** ADMIN creates their account from the Users page.

**What they can do:**
- View and create agreements (rental, hire-purchase, lease-to-own)
- Record customer payments and view payment schedules
- View finance dashboard (P&L, outstanding balance, top customers)
- Track vehicle expenses and operating costs
- View driver payroll records
- Access all financial reports (income statement, cash flow, profitability)
- Manage customers

**Home page after login:** `/finance`  
**Cannot access:** Vehicles (edit), Drivers, GPS map, Geofences, Maintenance  
**Sidebar shows:** Dashboard, Customers, Agreements, Finance, Reports, Documents, Settings, Support

---

### Role 5 — DRIVER

**Who this is:** An individual driver assigned to a vehicle.  
**How created:** Fleet Manager or Admin creates a driver profile through the Drivers page (5-step wizard). The driver is assigned a user account.

**What they can do:**
- See their own assigned vehicle with live telemetry (speed, fuel, location)
- View their own driver profile (license details, status)
- Upload their own documents (license, ID, medical certificate)
- See their license expiry warning (shown 60 days before expiry)
- Submit support tickets
- Change their own password

**Home page after login:** `/dashboard` (shows only their assigned vehicle)  
**Cannot access:** Any other vehicle, financial data, other drivers, reports  
**Sidebar shows:** Dashboard, Documents, Profile, Settings, Support

---

### Role 6 — VIEWER

**Who this is:** A read-only user — could be a company owner who just wants to watch, or an auditor.  
**How created:** ADMIN creates their account with the VIEWER role.

**What they can do:**
- View the live GPS map
- See fleet status (total vehicles, moving, idle, offline)
- Read recent alerts (cannot acknowledge or resolve)
- View the vehicle list (cannot edit)
- Submit support tickets

**Home page after login:** `/dashboard` (read-only fleet overview)  
**Cannot access:** Finance, Agreements, Drivers (edit), Maintenance (edit), Geofences (edit), Users  
**Sidebar shows:** Dashboard, Live Map, Vehicles (view only), Alerts (view only), Settings, Support

---

## 3. REGISTRATION AND APPROVAL FLOW

### How a new company gets access:

```
1. Visit https://articvms.ddnsgeek.com/register
2. Fill form: company name, first name, last name, email, country, password
3. Account created — organization status = PENDING
4. User logs in → sees /pending-approval (NOT the dashboard)
5. Pending approval page shows:
   - "Your registration is pending" banner
   - Preview of 8 features they'll unlock
   - Direct contact links (WhatsApp, phone, email, Instagram, TikTok)
   - "Leave us a message" form
6. Super Admin sees a red badge on Platform → Pending tab
7. Super Admin reviews → clicks Approve (selects a plan) or Reject (gives reason)
8. On Approve → org becomes ACTIVE → welcome email sent → user can now log in to dashboard
9. On Reject → user sees /rejected page with the reason shown
```

### How a staff member gets access:

```
1. Company ADMIN logs in → Users page → Add User
2. Fills: first name, last name, email, role, password
3. Clicks Create → account created immediately
4. ADMIN tells the staff member their email + password
5. Staff member logs in at /login
6. Redirected to their role-specific home page
```

---

## 4. PAGES AND PORTALS — HOW EACH ROLE EXPERIENCES THE SYSTEM

### 4.1 Public Pages (no login required)

| URL | Description |
|---|---|
| `/` | Landing page — features overview, Register + Sign In buttons |
| `/login` | Login form — dark branded design with "Forgot password?" link |
| `/register` | Company registration form — creates org + ADMIN account |
| `/forgot-password` | Email entry → secure reset link sent |
| `/reset-password?token=xxx` | Set new password using the emailed link |

---

### 4.2 SUPER_ADMIN Portal — `/platform`

**Design:** Full command center with 4 tabs at the top.

**Tab 1 — Companies**
- Table of all registered active companies
- Columns: name, country, plan, subscription status, users, vehicles, registered date
- Action: activate/change plan button (opens modal to select Free/Starter/Business/Enterprise)

**Tab 2 — Pending** (has red badge showing count)
- Cards for each company waiting for approval
- Shows: company name, email, country, number of users, registration date
- Plan selector dropdown
- Approve button (green) and Reject button (red)
- On reject: modal asks for rejection reason (shown to the company)

**Tab 3 — Support** (has red badge for open tickets)
- All support tickets from every user on the platform
- Each ticket shows: subject, message preview, category, priority, status, submitter email
- Admin can reply (typed in the "Admin reply" field) and change status (OPEN → IN_PROGRESS → RESOLVED → CLOSED)

**Tab 4 — Contacts**
- Edit the support contact links visible to all users
- Fields: Platform (e.g. "WhatsApp"), Value (e.g. "+250787585826"), URL, Icon key, Sort order
- Add new contacts, delete existing ones, drag to reorder
- Save button applies changes immediately sitewide

---

### 4.3 ADMIN / SUPER_ADMIN Dashboard — `/dashboard`

**Design:** Full command center with brand blue palette.

**Content:**
- 5 KPI cards: Total Vehicles, Moving Now, Idle, Offline, Active Alerts
- Live GPS map (left, 2/3 width) + Recent Alerts panel (right)
- Clicking an alert card highlights that vehicle on the map
- Fleet status progress bars (% moving / idle / offline)
- Finance snapshot: monthly income, expenses, profit
- Maintenance: overdue, due today, upcoming count
- Quick Actions grid: Add Vehicle, Add Driver, Live Map, Reports, Users, Finance
- 7-day vehicle activity line chart
- System health: GPS devices online, MQTT, server, database

---

### 4.4 FLEET_MANAGER Dashboard — `/dashboard`

**Design:** Same brand colors, different content focused on operations.

**Content:**
- 4 KPI cards: Total Vehicles, Moving Now, Idle, Active Alerts
- Large live GPS map (primary workspace, full width)
- Active Alerts panel with click-to-highlight-on-map
- Upcoming Maintenance panel with days-left badges (green / amber / red)
- Quick links: Vehicles, Drivers, Geofences, Documents

---

### 4.5 FINANCE_MANAGER Dashboard — `/finance` (lands here after login)

**Design:** Emerald/green accent on the Finance section header, no GPS map.

**Content:**
- Today's income, expenses, profit (3 large cards)
- Monthly KPIs: income, expenses, outstanding balance, payments due today
- Monthly cost breakdown bar chart (income, expenses, maintenance, fuel, fines)
- Active agreements list with overdue flags
- Top paying customers this month
- Compliance alerts: insurance/road tax expiring within 30 days

---

### 4.6 DRIVER Dashboard — `/dashboard`

**Design:** Personalized greeting with brand colors. No fleet-wide data.

**Content:**
- Personalized greeting: "Good morning, Jean" + today's date
- License expiry warning banner (shows if less than 60 days remaining)
- Assigned vehicle card:
  - Plate number (large)
  - Make, model, year
  - Vehicle status badge (ACTIVE / IDLE / OFFLINE)
  - Live telemetry: speed, fuel %, km today, engine on/off
  - Last known address
  - "View vehicle details" button
- Driver's own details: license number, class, status
- Quick links: My Profile, My Documents

---

### 4.7 VIEWER Dashboard — `/dashboard`

**Design:** Slate/gray palette, read-only, no edit buttons anywhere.

**Content:**
- 4 read-only chips: Total Vehicles, Moving, Idle, Active Alerts
- Full-width live GPS map (no lock/unlock buttons)
- Fleet status bars showing percentage in each state
- Recent alerts list (no acknowledge/resolve buttons)

---

### 4.8 Pending Approval Screen — `/pending-approval`

Shown to all users whose organization is still PENDING. They cannot access the normal dashboard.

**Content:**
- Yellow "pending" banner with company name
- 8 feature preview cards: GPS Tracking, Fleet Management, Driver Management, Smart Alerts, Financial Management, Maintenance, Document Management, Reports & Analytics
- Support contact cards: WhatsApp, Phone, Email, Instagram, TikTok (configured by Super Admin)
- "Leave us a message" collapsible form → submits a support ticket

---

### 4.9 Rejection Screen — `/rejected`

Shown when a company's registration was rejected.

**Content:**
- Red banner with rejection reason shown
- Steps to resolve: contact us, register again
- Support contact cards

---

### 4.10 Support Page — `/support` (all logged-in users)

**Content:**
- Contact cards: WhatsApp, Phone, Email, Instagram, TikTok
- Submit ticket form: category, subject, message
- "My tickets" panel showing past submissions with status and admin replies

---

## 5. KEY PAGES — DETAIL

### Vehicles (`/vehicles`)
- Table with search + status filter + pagination (20 per page)
- Columns: vehicle name/make/year, plate + class, fleet group, live status (GPS-driven), engine lock toggle, last seen
- Engine lock requires typing the plate number to confirm
- Each row: view details, edit, delete
- Real-time status updates via Socket.IO

### Vehicle Detail (`/vehicles/[id]`)
5 tabs:
1. **Overview** — live GPS, last position, fuel, speed, GPS ping button
2. **GPS History** — replay route on map with date range selector
3. **Telemetry** — speed/fuel/temperature charts
4. **Device Commands** — remote MQTT commands (ping, lock, unlock, internet check, USSD)
5. **Documents** — upload and verify vehicle documents

### Drivers (`/drivers`)
- Card grid showing all drivers
- Each card: name, license number, expiry, assigned vehicle, status
- "Add Driver" button opens a 5-step wizard: Personal → License → Employment → Health → Banking
- "Assign Vehicle" button per driver

### Alerts (`/alerts`)
- List with search (title/message/plate), status filter, severity filter
- Each alert: severity badge, title, message, vehicle + plate, timestamp
- Acknowledge button (yellow) and Resolve button (green)
- Real-time new alerts toast via Socket.IO

### Maintenance (`/maintenance`)
Two tabs:
1. **Upcoming** — vehicles with service/inspection/insurance/road tax expiring in 60 days
2. **Service Records** — full history with search, edit, delete

### Documents (`/documents`)
Two tabs:
1. **Compliance Overview** — KPI cards (expired, expiring 30d, pending review, verified), list of critical documents
2. **All Documents** — searchable list with verify/reject/delete actions

### Finance (`/finance`)
Three tabs:
1. **Dashboard** — P&L, outstanding balance, top customers, compliance alerts
2. **Contracts** — legacy rental/lease contracts list and creation
3. **Expenses** — vehicle expense records with 20 categories

### Agreements (`/agreements`)
- List with status filter
- "New Agreement" button opens modal with:
  - Business model template picker (6 pre-configured templates)
  - Vehicle and customer selectors
  - Rate, period, deposit, installment count fields
  - Start/end dates
- Clicking an agreement opens the detail page

### Agreement Detail (`/agreements/[id]`)
Three tabs:
1. **Payment Schedule** — auto-generated grid with "Pay" button per row
2. **Payment History** — all recorded payments with method, reference, date
3. **Details** — agreement terms snapshot

### Platform (`/platform`) — SUPER_ADMIN only
Four tabs: Companies, Pending Approvals, Support Tickets, Contact Configuration

### Settings (`/settings`)
Four tabs:
1. **Organization** — company name, email, phone, country
2. **Subscription** — plan name, status, seats used, trial end date, enabled features
3. **Alert Rules** — create/delete speed/fuel/temperature alert rules
4. **Members** — list of all team memberships with roles and status (ADMIN only)

---

## 6. HOW AUTHENTICATION WORKS

1. User goes to `/login`, enters email + password
2. Backend validates credentials → issues **JWT access token** (15-minute expiry) + **refresh token** (7 days)
3. Both tokens stored in browser localStorage via Zustand store
4. Every API request sends `Authorization: Bearer <token>` header
5. When access token expires, the frontend automatically calls `/auth/refresh` and retries
6. If refresh token also expires → user is logged out and redirected to `/login`
7. Logout deletes the refresh token from the database

**Password reset flow:**
1. User clicks "Forgot password?" → enters email
2. Backend generates a random 64-character token, stores only its SHA-256 hash
3. Sends email with link: `https://articvms.ddnsgeek.com/reset-password?token=xxx`
4. Link expires in 30 minutes, single-use
5. On submit → password updated, all sessions invalidated, confirmation email sent

---

## 7. HOW THE GPS TRACKING WORKS

```
ESP32 device (in vehicle)
    │
    │ MQTT publish every 2 seconds
    │ Topic: artic/<deviceToken>/telemetry
    │
MQTT Broker (Aedes, port 1883)
    │
Backend MQTT Client
    │ Processes telemetry: saves to DB, updates LastLocation, checks geofences, fires alerts
    │
Socket.IO server
    │ Emits location:update events to connected browsers
    │
Browser (Live Map)
    │ Leaflet map marker moves in real time
```

Each vehicle has a unique `deviceToken` (UUID). This token is the MQTT "password" for that device. It appears in the vehicle detail page under Device Commands, and is programmed into the ESP32 firmware.

**Status logic:**
- **ACTIVE** = device sent a message within 30 seconds AND speed ≥ 2 km/h
- **IDLE** = device sent a message within 30 seconds AND speed < 2 km/h
- **OFFLINE** = no message for more than 30 seconds

---

## 8. HOW THE SIDEBAR IS BUILT

The sidebar is driven by a single source of truth: `frontend/src/lib/roles.ts`.

This file defines `NAV_ITEMS` — an array where each item has `href`, `label`, `icon`, and optionally a `roles` array. If `roles` is defined, only users with those roles see that link.

The `getNavItems(role)` function filters the list for the current user's role. The Sidebar component calls this function and renders only the permitted links.

This means adding a new page to the sidebar requires only adding one entry to `NAV_ITEMS` — the filtering happens automatically.

**Role → home page mapping** is also in `roles.ts`:
```
SUPER_ADMIN    → /platform
ADMIN          → /dashboard
FLEET_MANAGER  → /dashboard
FINANCE_MANAGER → /finance
DRIVER         → /dashboard
VIEWER         → /dashboard
```

The dashboard layout (`layout.tsx`) uses `canAccess(role, pathname)` to redirect users who visit a URL they're not allowed to see.

---

## 9. SUBSCRIPTION PLANS (configured in DB)

| Plan | Price | Seats | Features |
|---|---|---|---|
| Free | $0/mo | 3 | GPS tracking, vehicles |
| Starter | $19/mo | 10 | + Drivers, alerts |
| Business | $49/mo | 25 | + Finance, maintenance, reports |
| Enterprise | $99/mo | 100 | + AI assistant, double-entry accounting |

Plans are seeded into the database. Super Admin assigns a plan to each company from the Platform → Pending tab (when approving) or Platform → Companies tab (for existing companies).

---

## 10. EMAIL NOTIFICATIONS (SMTP via Gmail)

**SMTP:** smtp.gmail.com:587 using Gmail App Password  
**From:** byiringirofabrice6@gmail.com

| Trigger | Email sent |
|---|---|
| New company registers | Welcome email to the new admin |
| Company approved by Super Admin | Welcome email to all company admins |
| Forgot password request | Reset link (30-min expiry) |
| Password changed | Confirmation to the user |
| Payment becomes overdue | Reminder to customer email |
| Document expiring in 30 days | Warning to organization email |
| Document expiring in 7 days | Urgent warning to organization email |

---

## 11. DATABASE SUMMARY

**Database:** PostgreSQL 16 · `fleet_management`  
**ORM:** Prisma 5

**Core tables:**
- `organizations` — companies (with `status`: PENDING/ACTIVE/REJECTED/SUSPENDED)
- `users` — all accounts (one email = one account)
- `memberships` — user ↔ organization links with roles
- `plans` / `subscriptions` / `entitlements` — SaaS billing layer
- `vehicles` — 70+ fields per vehicle
- `drivers` — driver profiles linked to users
- `gps_devices` — GPS hardware records
- `telemetry` — raw GPS history (every 2 seconds)
- `last_locations` — latest position per vehicle
- `alerts` / `alert_rules` — events and thresholds
- `geofences` / `geofence_events` — zone definitions
- `maintenance_records` — service history
- `documents` — uploaded files with verification
- `agreements` — contracts (rental, hire-purchase, etc.)
- `scheduled_payments` — auto-generated due dates
- `payment_records` — actual payments received
- `support_contacts` — contact links (WhatsApp, etc.)
- `support_tickets` — user-submitted issues
- `password_reset_tokens` — secure password recovery
- `audit_logs` — sensitive action tracking
