# ARTIC VMS — Complete User List & Portal Designs
**Version:** October 2026 | Based on: codebase + master spec + UI/UX spec

---

## Part 1 — The Complete User List

| # | User Type | Role Code | How They Enter | Identity Records | Home Page | Status |
|---|-----------|-----------|----------------|-----------------|-----------|--------|
| 1 | Platform Super Admin | `SUPER_ADMIN` | Seed script only. Cannot self-register. | `user` + platform grant | `/platform` | ✅ Built |
| 2 | Platform Support Agent | `PLATFORM_SUPPORT` | Super Admin creates + grants support scope | `user` + support grant | `/platform/support` | ❌ Not built |
| 3 | Company Owner | `ADMIN` (first user) | Registers company at `/register` → approved | `user` + `organization` + `membership` | `/dashboard` | ✅ Built |
| 4 | Company Administrator | `ADMIN` | Invited by Owner/Admin | `user` + `membership` | `/dashboard` | ✅ Built |
| 5 | Fleet Manager | `FLEET_MANAGER` | Invited by Admin | `user` + `membership` | `/dashboard` | ✅ Built |
| 6 | Transport Dispatcher | `DISPATCHER` | Invited by Admin | `user` + `membership` | `/dispatch` | 🔶 Role added, page partial |
| 7 | Driver | `DRIVER` | Self-register personal OR created by Fleet Manager | `user` + `driver_profile` | `/dashboard` (driver variant) | ✅ Built |
| 8 | Motorcycle Rider | `DRIVER` (rider variant) | Self-register OR assigned by operator | `user` + `driver_profile` | `/rider` | 🔶 Route missing |
| 9 | Vehicle Owner | `VIEWER` (personal) | Self-register personal account | `user` + `ownerUserId` on vehicle | `/owner` | 🔶 Backend added, page partial |
| 10 | Rental Manager | `RENTAL_MANAGER` | Invited by Admin | `user` + `membership` | `/rentals` | 🔶 Role added, page missing |
| 11 | Vehicle Sales Agent | `SALES_AGENT` | Invited by Admin | `user` + `membership` | `/sales` | ❌ Not built |
| 12 | Accountant | `ACCOUNTANT` | Invited by Admin | `user` + `membership` | `/finance` (record-only) | ❌ Not built |
| 13 | Finance Manager | `FINANCE_MANAGER` | Invited by Owner | `user` + `membership` | `/finance` | ✅ Built |
| 14 | HR Manager | `HR_MANAGER` | Invited by Admin | `user` + `membership` | `/staff` | 🔶 Role added, page missing |
| 15 | Mechanic / Technician | `MECHANIC` | Invited by Admin | `user` + `membership` | `/workshop` | 🔶 Role added, page missing |
| 16 | Compliance Officer | `COMPLIANCE_OFFICER` | Invited by Admin | `user` + `membership` | `/compliance` | 🔶 Role added, page missing |
| 17 | Auditor | `VIEWER` (read-only) | Granted by Owner with expiry | `user` + time-limited access | `/audit-view` | ❌ Not built |
| 18 | Customer / Passenger | `VIEWER` (personal) | Self-register personal account | `user` + `customer_profile` | `/customer` | 🔶 Route missing |
| 19 | Vehicle Dealer / Seller | `SALES_AGENT` | Self-register OR invited | `user` + `provider_profile` | `/seller` | ❌ Not built |
| 20 | Service Provider | `VIEWER` (personal) | Self-register at `/register/provider` | `user` + `provider_profile` | `/provider` | ❌ Not built |

**Legend:** ✅ Built | 🔶 Partial | ❌ Not built

---

## Part 2 — Portal Design for Every User

Each portal is described with: purpose, sidebar items, home page layout, key pages, and what they must NEVER see.

---

### Portal 1 — Super Admin (`SUPER_ADMIN`)
**Purpose:** Operates the ARTIC VMS platform. Approves companies, manages plans, monitors health.

**Sidebar:**
```
Platform         ← home
├─ Overview
├─ Companies
├─ Pending Approvals  🔴 badge
├─ Support Tickets   🔴 badge
├─ Contacts
├─ Plans
├─ Audit Log
└─ System Health
─────────────────
Settings
Support
```

**Home page `/platform`:**
```
┌─────────────────────────────────────────────────────────┐
│ Platform Control                    [Oct 2026 ▾]        │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Companies 47 │ Pending 3    │ Users 1,204  │ Open Tickets│
│              │  ↑ needs action              │ 7          │
├──────────────┴──────────────┴──────────────┴────────────┤
│ [Companies] [Pending] [Tickets] [Contacts] [Plans]      │
│             [Audit Log] [Health]                        │
├─────────────────────────────────────────────────────────┤
│ COMPANIES                          SYSTEM HEALTH        │
│ [table: name, plan, users,         API  ●  DB ●         │
│  vehicles, status, actions]        Redis ● MQTT ●       │
│                                    SMTP ●               │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/platform` — overview with 4 KPI cards + companies table + system health
- `/platform` → Pending tab — review cards: company name, email, date + Approve/Reject
- `/platform` → Tickets tab — support tickets with status, reply box
- `/platform` → Contacts tab — edit WhatsApp/phone/email/Instagram/TikTok links
- `/platform` → Plans tab — CRUD plan definitions (Free/Starter/Business/Enterprise)
- `/platform` → Audit tab — immutable event log with filters
- `/platform` → Health tab — service status (API/DB/Redis/MQTT/SMTP) with ping

**Must NEVER see:** User passwords, company operational data (trips, customers, finances) except via logged impersonation, payment card numbers.

---

### Portal 2 — Company Owner / Admin (`ADMIN`)
**Purpose:** Runs the company day-to-day. Manages all users, settings, and operations.

**Sidebar:**
```
Dashboard        ← home
Live Map
Vehicles
Drivers
Dispatch
Alerts
Geofences
Maintenance
──────────────
Customers
Agreements
Finance
Approvals   🔴 badge
Reports
Documents
──────────────
Users
Settings
Support
```

**Home page `/dashboard` (admin variant):**
```
┌─────────────────────────────────────────────────────────┐
│ Kigali Motors Ltd          Mon 26 Oct 2026  [⚙ Settings]│
├────────────┬────────────┬────────────┬──────────────────┤
│ Vehicles   │ Active Now │ Alerts     │ Revenue (month)  │
│ 42         │ 18         │ 3 critical │ RWF 4.2M         │
├────────────┴────────────┴────────────┴──────────────────┤
│ ┌──────────────────────────────┐  ┌─────────────────── ┐│
│ │     LIVE MAP (compact)       │  │  APPROVAL INBOX    ││
│ │     [Leaflet dark tiles]     │  │  • Payout RWF 2.3M ││
│ │     vehicle markers moving   │  │  • Finance Mgr role ││
│ │                              │  │  • Refund RWF 45k  ││
│ └──────────────────────────────┘  └────────────────────┘│
├─────────────────────────────────────────────────────────┤
│ FLEET STATUS BAR                                        │
│ Active ████████████░░░░░░ 18/42   Idle ████░ 8/42       │
│ Offline ██░░░░░░░░░░░░░░░ 4/42   Maintenance 2/42       │
├─────────────────────────────────────────────────────────┤
│ RECENT ALERTS          UPCOMING MAINTENANCE             │
│ • RAB 123 A overspeed  • RAC 456 B — service in 3 days  │
│ • Geofence exit 14:30  • RAB 001 A — insurance 7 days   │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/dashboard` — full overview with map, approvals inbox, fleet status bars
- `/users` — list all members, invite, reset passwords, set roles
- `/approvals` — payout requests, role grants, contract amendments
- `/settings` — org info, subscription, alert rules, branches, integrations

**Must NEVER see:** Other companies' data, platform config, user passwords.

---

### Portal 3 — Fleet Manager (`FLEET_MANAGER`)
**Purpose:** GPS tracking, vehicle management, driver ops, maintenance, compliance.

**Sidebar:**
```
Dashboard
Live Map     ← most used
Vehicles
Drivers
Dispatch     (view only)
Alerts
Geofences
Maintenance
Workshop     (view)
Compliance   (view)
Telemetry
──────────────
Customers
Agreements
Reports
Documents
──────────────
Settings
Support
```

**Home page `/dashboard` (fleet variant):**
```
┌─────────────────────────────────────────────────────────┐
│ Fleet Dashboard                                         │
├────────────┬────────────┬────────────┬──────────────────┤
│ Vehicles 42│ Active 18  │ Alerts 3   │ Expiring Docs 7  │
├─────────────────────────────────────────────────────────┤
│          LIVE MAP — full width                          │
│  [Dark CartoDB tiles, all org vehicles,                 │
│   click marker → vehicle popup with speed/fuel/lock]    │
├─────────────────────────────────────────────────────────┤
│ ACTIVE ALERTS (3)                                       │
│ 🔴 RAB 123 A — speeding 87km/h  [Acknowledge]          │
│ 🟡 Insurance expiry — RAD 004 D  [View]                │
├─────────────────────────────────────────────────────────┤
│ UPCOMING MAINTENANCE              DOCUMENT EXPIRY STRIP │
│ RAC 003 C — oil change 3 days     RAB 001 A ins. 7d     │
│ RAB 001 A — inspection 7 days     RAC 456 B licence 14d │
│                                                         │
│ [+ Add maintenance]               [View all documents]  │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/map` — full-screen dark map, all vehicles, layer switcher (Dark/Satellite/Hybrid)
- `/vehicles` — list with pagination, search, add vehicle
- `/vehicles/[id]` — 7 tabs: Overview(map), GPS History, Telemetry, Device Commands, Documents, Ownership, Assignments
- `/drivers` — list, 5-step wizard, assignment management
- `/alerts` — search + pagination + acknowledge/resolve
- `/geofences` — draw polygon/circle on map, CRUD, events

**Must NEVER see:** Financial statements, payroll, customer payment data, other companies.

---

### Portal 4 — Transport Dispatcher (`DISPATCHER`)
**Purpose:** Assigns drivers to trips, monitors live availability, resolves conflicts.

**Sidebar:**
```
Dashboard
Dispatch     ← home
Live Map
Vehicles     (view)
Drivers      (view)
Alerts       (ops only)
──────────────
Settings
Support
```

**Home page `/dispatch`:**
```
┌─────────────────────────────────────────────────────────┐
│ Dispatch Board  [Today ▾] [+ New Trip]  🔴 2 conflicts  │
├──────────────┬──────────────┬──────────────┬────────────┤
│ UNASSIGNED 4 │ ASSIGNED 3   │ IN PROGRESS 2│ COMPLETED 9│
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │            │
│ │ #TRP-104 │ │ │ #TRP-103 │ │ │ #TRP-101 │ │ ✓ TRP-096 │
│ │ Airport  │ │ │ Staff run│ │ │ Kigali → │ │ ✓ TRP-097 │
│ │ 08:30    │ │ │ 07:00    │ │ │ Musanze  │ │ ✓ TRP-098 │
│ │ 3 pax    │ │ │ Jean M.  │ │ │ Eric K.  │ │            │
│ │[Assign ▾]│ │ │RAB 123 A │ │ │RAC 456 B │ │            │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │            │
└──────────────┴──────────────┴──────────────┴────────────┘

RIGHT DRAWER (when Assign clicked):
┌────────────────────────────────┐
│ Assign Trip #TRP-104           │
│ Airport Run · 08:30            │
├────────────────────────────────┤
│ SELECT DRIVER                  │
│ ○ Jean M. ● Available lic:14d  │
│ ○ Eric K.  ● On trip           │
│ ○ Alice N. ● Day off           │
├────────────────────────────────┤
│ SELECT VEHICLE                 │
│ ○ RAB 123 A — Toyota Hiace     │
│   ● Active · 68% fuel          │
│ ○ RAB 002 B — Toyota Hiace     │
│   ○ Idle · 45% fuel            │
├────────────────────────────────┤
│ ⚠ Conflict warnings:           │
│ Jean M. licence expires 14 days│
├────────────────────────────────┤
│ [Cancel]  [Confirm Assignment] │
└────────────────────────────────┘
```

**Key pages:**
- `/dispatch` — 4-column Kanban board + assign drawer + conflict panel
- `/map` — live view of vehicles in-transit, available, offline
- `/vehicles` — view status, fuel, availability (no edit)
- `/drivers` — view availability, licence validity, current assignment (no edit)

**Must NEVER see:** Financials, payroll, customer payment data, vehicle acquisition costs.

---

### Portal 5 — Finance Manager (`FINANCE_MANAGER`)
**Purpose:** Full financial control — invoices, payments, payroll, owner statements, reports.

**Sidebar:**
```
Dashboard
Finance      ← home
├─ Overview
├─ Invoices
├─ Payments
├─ Expenses
├─ Owner Statements
└─ Reports
Approvals   🔴 badge
Customers
Agreements
Reports
Documents   (financial)
──────────────
Settings
Support
```

**Home page `/finance`:**
```
┌─────────────────────────────────────────────────────────┐
│ Finance                       [Oct 2026 ▾]  [+ Invoice] │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Revenue      │ Outstanding  │ Expenses     │ Net P&L    │
│ RWF 12.4M    │ RWF 3.2M     │ RWF 4.8M     │ RWF 7.6M   │
├─────────────────────────────────────────────────────────┤
│ [Overview] [Invoices] [Payments] [Expenses]             │
│ [Owner Statements] [Reports]                            │
├─────────────────────────────────────────────────────────┤
│ P&L CHART (monthly bars)    OUTSTANDING BY CUSTOMER     │
│ [bar chart — income vs      Jean Kagabo    RWF 450k  ⚠  │
│  expenses 6 months]         ACME Ltd       RWF 220k     │
│                             Express Rides  RWF 180k     │
├─────────────────────────────────────────────────────────┤
│ PENDING APPROVALS                                       │
│ • Payout to Jean (owner) RWF 330k  [Approve] [Reject]  │
│ • Refund request #RF-042 RWF 45k   [Approve] [Reject]  │
└─────────────────────────────────────────────────────────┘
```

**Finance tabs detail:**
- **Overview** — P&L, outstanding, top customers, cash flow chart
- **Invoices** — table: number, customer, issue date, due, amount, balance, status (+ create, download PDF)
- **Payments** — table: reference, payer, method, amount, allocation + reconciliation panel
- **Expenses** — 20-category expense records, vehicle breakdown
- **Owner Statements** — per-owner monthly statement: gross → fee → expenses → net → payout
- **Reports** — income statement, vehicle profitability, driver payroll, receivables ageing, CSV export

**Must NEVER see:** Live GPS positions (unless explicitly granted), driver personal documents beyond financial need.

---

### Portal 6 — Accountant (`ACCOUNTANT`)
**Purpose:** Records financial transactions. Cannot approve or execute payouts.

**Sidebar:** Same as Finance Manager but Approve/void buttons replaced with "Submit for approval".

**Home page `/finance` (record-only variant):**
- Same 6 tabs but approve/void buttons hidden
- "Submit for approval" button instead of "Approve"
- No payout execution
- Can reconcile; cannot authorize

**Must NEVER see:** Payout execution controls, high-level approval queue.

---

### Portal 7 — Driver (`DRIVER`)
**Purpose:** Sees own assigned vehicle, trips, earnings, documents.

**Sidebar:**
```
Dashboard    ← home (driver variant)
My Vehicles  ← owner view if has vehicles
Support
```

**Home page `/dashboard` (driver variant):**
```
┌─────────────────────────────────────────────────────────┐
│ Good morning, Jean ☀  Monday 26 Oct 2026                │
├─────────────────────────────────────────────────────────┤
│ ⚠ Your licence expires in 47 days — renew soon          │
├─────────────────────────────────────────────────────────┤
│ ASSIGNED VEHICLE                                        │
│ ┌───────────────────────────────────────────────────┐   │
│ │ RAB 123 A · Toyota Hiace 2019         ● ACTIVE    │   │
│ │                                                   │   │
│ │ Speed  42 km/h   Fuel  68%   Engine  ON           │   │
│ │ 84 km driven today                                │   │
│ │ Last: KN 3 Rd, Kigali                             │   │
│ │ [View on map]    [Vehicle details]                │   │
│ └───────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ MY DETAILS                        QUICK LINKS           │
│ Licence: DL-123456               [My Profile]           │
│ Class: B                         [My Documents]         │
│ Status: Active                   [My Earnings]          │
│ Phone: +250 78X XXX XXX          [Report Incident]      │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/dashboard` — greeting, licence expiry banner, assigned vehicle card with live telemetry
- `/driver` (future) — trip history, earnings breakdown, document upload
- `/profile` — personal info, emergency contact, bank details

**Must NEVER see:** Other vehicles, other drivers' records, company finances, customer personal data.

---

### Portal 8 — Motorcycle Rider (`DRIVER` rider variant)
**Purpose:** Motorcycle remittance tracking — daily/weekly obligations to owner/operator.

**Sidebar:**
```
Dashboard    ← home
Remittances  ← unique to rider
My Motorcycle
My Agreement
Support
```

**Home page `/rider`:**
```
┌─────────────────────────────────────────────────────────┐
│ Good morning, Patrick  Mon 26 Oct                       │
├─────────────────────────────────────────────────────────┤
│ ASSIGNED MOTORCYCLE                                     │
│ RAC 456 B · Honda CB 125        ● ACTIVE               │
│ Today: 42 km driven · Engine ON                         │
├─────────────────────────────────────────────────────────┤
│ REMITTANCE STATUS                                       │
│ ┌───────────────────────────────────────────────────┐   │
│ │ Today's obligation       RWF 8,000                │   │
│ │ Paid                     RWF 5,000                │   │
│ │ Remaining                RWF 3,000  ← red if late │   │
│ │ Arrears                  RWF 0                    │   │
│ │                                                   │   │
│ │ [Record Payment]  [View History]                  │   │
│ └───────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ THIS WEEK                         MY AGREEMENT          │
│ Mon ✓  Tue ✓  Wed ✓               Type: Daily           │
│ Thu ●  Fri ○  Sat ○               Amount: RWF 8,000/day │
│ Total paid: RWF 24,000            Owner: Jean K.        │
│ Total due: RWF 40,000             [View full agreement] │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/rider` — motorcycle status, daily remittance widget, week calendar
- Remittance history — paid/unpaid by day, arrears
- My agreement — terms, owner contact, dispute button

---

### Portal 9 — Vehicle Owner (`VIEWER` personal with ownerUserId)
**Purpose:** Tracks income, expenses and net from vehicles they own (managed by a company or self-managed).

**Sidebar:**
```
My Vehicles  ← home
Statements
Payouts
Agreements
──────────────
Support
```

**Home page `/owner`:**
```
┌─────────────────────────────────────────────────────────┐
│ My Vehicles                           [+ Register vehicle]│
├─────────────────────────────────────────────────────────┤
│ VEHICLE CARD — RAB 123 A · Toyota Hiace 2019            │
│ ┌───────────────────────────────────────────────────┐   │
│ │ Managed by: Kigali Motors Ltd      ● Active       │   │
│ │ ─────────────────────────────────────────────     │   │
│ │ [Live map — own vehicle only]                     │   │
│ │                                                   │   │
│ │ This month:                                       │   │
│ │ Income      RWF 450,000                           │   │
│ │ Expenses    RWF 120,000                           │   │
│ │ Mgmt fee    RWF  60,000                           │   │
│ │ Net         RWF 270,000  ← teal                   │   │
│ │ Next payout: 30 Nov                               │   │
│ │                                                   │   │
│ │ [View Statements] [View Agreement] [Contact Mgr]  │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ VEHICLE CARD — RAC 789 D · Self-managed                 │
│ ┌───────────────────────────────────────────────────┐   │
│ │ Self-managed                                      │   │
│ │ Income RWF 0  Expenses RWF 45,000  Net -RWF 45,000│   │
│ │ [View expenses]  [Assign a manager]               │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/owner` — vehicle cards with income/expense/net, live map per vehicle
- `/owner/statements` — monthly table: income, expenses, fee, net (6 months rolling)
- `/owner/payouts` — payout history: amount, date, method, status
- `/owner/vehicles/[id]` — vehicle detail: maintenance history, agreements, documents

**Must NEVER see:** Managing company's internal operations, driver personal data, other owners' vehicles.

---

### Portal 10 — Customer (`VIEWER` personal)
**Purpose:** Manages their bookings, agreements, and payments.

**Sidebar:**
```
My Bookings  ← home
Agreements
Payments
Support
```

**Home page `/customer`:**
```
┌─────────────────────────────────────────────────────────┐
│ Welcome, Alice                       [+ New booking]    │
├─────────────────────────────────────────────────────────┤
│ ACTIVE BOOKING                                          │
│ ┌───────────────────────────────────────────────────┐   │
│ │ #BK-2042 · RAB 123 A · Toyota Hiace               │   │
│ │ Rental · Started 20 Oct · Ends 27 Oct             │   │
│ │                                                   │   │
│ │ [Live map — this vehicle only]                    │   │
│ │ "Showing your booking vehicle only"               │   │
│ │                                                   │   │
│ │ Driver: Jean (assigned)                           │   │
│ │ ETA: 3 min · KN 3 Rd, Kigali                     │   │
│ │                                                   │   │
│ │ Balance due: RWF 45,000   Due: 27 Oct             │   │
│ │ [Make payment]  [Extend booking]  [Contact driver]│   │
│ └───────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ PAST BOOKINGS              OPEN AGREEMENTS              │
│ BK-2040  RAC 003  Oct 15   Hire-purchase  RAD 004 D     │
│ BK-2035  RAB 002  Oct 08   8/24 payments  RWF 22k/mo   │
│ BK-2030  RAB 001  Sep 28   Next: 01 Nov               │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/customer` — active booking with live map, balance due
- `/customer/bookings/[id]` — booking detail, payments, documents, driver info
- `/customer/agreements/[id]` — hire-purchase schedule, paid/upcoming installments

**Must NEVER see:** Other customers' bookings, provider internal data, driver personal details beyond first name.

---

### Portal 11 — Rental Manager (`RENTAL_MANAGER`)
**Purpose:** Manages vehicle availability, reservations, handovers, deposits, damage.

**Sidebar:**
```
Rentals      ← home
├─ Calendar
├─ Reservations
├─ Active rentals
├─ Returns
├─ Deposits
└─ Damage reports
Vehicles     (rental view)
Customers
Agreements
Support
```

**Home page `/rentals`:**
```
┌─────────────────────────────────────────────────────────┐
│ Rentals                  [+ New reservation]  Oct 2026  │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Available    │ Rented now   │ Returns today│ Overdue    │
│ 8 vehicles   │ 12 vehicles  │ 3            │ 2          │
├─────────────────────────────────────────────────────────┤
│ AVAILABILITY CALENDAR (vehicle × date grid)             │
│         26 Oct  27 Oct  28 Oct  29 Oct  30 Oct          │
│ RAB 001  ████  █ Jean  ░░░░░  ░░░░░  ░░░░░             │
│ RAB 002  █ Ali ████████████  ░░░░░  ░░░░░             │
│ RAC 003  ░░░  ░░░░░  ░░░░░  ░░░░░  ░░░░░             │
│ RAD 004  MNT  MNT    ░░░░░  ░░░░░  ░░░░░             │
│ [Click slot → create/view reservation]                  │
├─────────────────────────────────────────────────────────┤
│ TODAY'S HANDOVERS          TODAY'S RETURNS              │
│ 09:00 RAB 001 → Alice K.   14:00 RAC 003 ← Jean M.     │
│ 14:00 RAC 456 → Eric N.    17:00 RAB 002 ← Alice K.    │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/rentals` — availability calendar + today's handovers/returns
- `/rentals/[id]` — reservation detail: vehicle, customer, dates, deposit, condition photos
- Handover flow: checklist (fuel, odometer, 6 photos, accessories) → digital signature → PDF stored

---

### Portal 12 — HR Manager (`HR_MANAGER`)
**Purpose:** Employee records, qualifications, attendance, leave, shifts.

**Sidebar:**
```
Staff / HR   ← home
├─ People
├─ Qualifications
├─ Attendance
├─ Shifts
└─ Leave
Documents
Reports (HR)
Support
```

**Home page `/staff`:**
```
┌─────────────────────────────────────────────────────────┐
│ Staff & HR                         [+ Add employee]     │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Employees 24 │ On leave 2   │ Expiring     │ Pending    │
│              │              │ licences 3   │ leave 4    │
├─────────────────────────────────────────────────────────┤
│ [People] [Qualifications] [Attendance] [Shifts] [Leave] │
├─────────────────────────────────────────────────────────┤
│ PEOPLE TABLE                        QUALIFICATION EXPIRY│
│ Name      Role      Status  Dept    Jean M. Licence 14d │
│ Jean M.   Driver    Active  Ops     Eric K. Medical 30d │
│ Eric K.   Driver    Active  Ops     Alice N. First Aid  │
│ Alice N.  Dispatch  Active  Admin   expired 3 days ago  │
│ [View] [Edit] [Deactivate]          [Send reminder]     │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/staff` — employee table + 5 tabs (People/Qualifications/Attendance/Shifts/Leave)
- `/staff/[id]` — full employee profile: personal, emergency, documents, qualifications, history
- Qualification expiry feeds dispatch conflict warnings automatically

**Must NEVER see:** Payroll amounts (unless granted), medical records beyond lawful necessity.

---

### Portal 13 — Mechanic / Technician (`MECHANIC`)
**Purpose:** Workshop work orders — assigned jobs only.

**Sidebar:**
```
Workshop     ← home
├─ My queue
├─ All open orders
├─ Parts
└─ History
Support
```

**Home page `/workshop`:**
```
┌─────────────────────────────────────────────────────────┐
│ Workshop                            Mon 26 Oct 2026     │
├──────────────┬──────────────┬──────────────────────────┤
│ My queue 3   │ Open total 7 │ Completed today 2        │
├─────────────────────────────────────────────────────────┤
│ MY WORK QUEUE                                           │
│ ┌─────────────────────────────────────────────────┐     │
│ │ WO-1042 · RAB 123 A · Toyota Hiace 2019         │     │
│ │ Issue: Oil change + brake inspection            │     │
│ │ Priority: HIGH    Assigned: 08:00 today         │     │
│ │ Odometer: 84,210 km                             │     │
│ │ [Photos ×3]  [Parts list]                       │     │
│ │ Status: [IN PROGRESS ▾]                         │     │
│ │ [Update status] [Log hours] [Request parts]     │     │
│ └─────────────────────────────────────────────────┘     │
│ ┌─────────────────────────────────────────────────┐     │
│ │ WO-1041 · RAC 003 C · Bajaj Boxer               │     │
│ │ Issue: Tyre replacement — rear left             │     │
│ │ Status: PENDING PARTS                           │     │
│ └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/workshop` — own queue + status updates + parts logging
- Work order detail: vehicle info (plate, model), issue, photos, parts, hours, completion

**Must NEVER see:** Vehicle acquisition costs, customer identity, driver personal data, any financial records.

---

### Portal 14 — Compliance Officer (`COMPLIANCE_OFFICER`)
**Purpose:** Document verification, licence/permit expiry, non-compliant vehicle flagging.

**Sidebar:**
```
Compliance   ← home
├─ Overview
├─ Document review queue
├─ Licences & permits
├─ Incidents
└─ Reports
Alerts
Documents
Support
```

**Home page `/compliance`:**
```
┌─────────────────────────────────────────────────────────┐
│ Compliance Dashboard                                    │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Pending docs │ Expiring 7d  │ Expired      │ Non-compl. │
│ review: 8    │ 5 vehicles   │ 3 documents  │ 2 vehicles │
├─────────────────────────────────────────────────────────┤
│ DOCUMENT REVIEW QUEUE                                   │
│ ● RAB 123 A — Insurance PDF      [Verify] [Reject]     │
│ ● Jean M.  — Driving licence    [Verify] [Reject]     │
│ ● RAC 003 C — Road tax cert     [Verify] [Reject]     │
├─────────────────────────────────────────────────────────┤
│ EXPIRY CALENDAR (next 30 days)                          │
│ 28 Oct  RAD 004 D — Inspection cert (2 days)  🔴       │
│ 01 Nov  RAB 002 B — Road tax (6 days)         🟡       │
│ 07 Nov  RAC 003 C — Insurance (12 days)       🟡       │
├─────────────────────────────────────────────────────────┤
│ NON-COMPLIANT VEHICLES (blocked from dispatch)          │
│ RAB 001 A — expired inspection   [Unblock when fixed]   │
└─────────────────────────────────────────────────────────┘
```

**Key pages:**
- `/compliance` — overview with review queue, expiry calendar, non-compliant list
- Document verify/reject with reason → updates document status → triggers alert
- Flag vehicle NON_COMPLIANT → automatically blocks dispatch

**Must NEVER see:** Financial records, customer data, payroll.

---

### Portal 15 — Auditor (read-only grant)
**Purpose:** Time-limited read-only access to a company's records for audit purposes.

**Sidebar:** Same as Admin but every item read-only, no action buttons anywhere.

**Persistent banner on every page:**
```
┌─────────────────────────────────────────────────────────┐
│ 👁  AUDITOR VIEW — Read-only. All access is logged.     │
│    Granted by: Jane (Owner) · Expires: 31 Dec 2026      │
└─────────────────────────────────────────────────────────┘
```

**Home page `/audit-view`:**
```
┌─────────────────────────────────────────────────────────┐
│ [AUDITOR BANNER — always visible]                       │
├─────────────────────────────────────────────────────────┤
│ Dashboard (read-only)    Vehicles (read-only)           │
│ Finance (read-only)      Documents (metadata only)      │
│ Agreements (read-only)   Reports (view only)            │
├─────────────────────────────────────────────────────────┤
│ AUDIT TRAIL (what I've accessed)                        │
│ 14:32 Viewed vehicle RAB 123 A                         │
│ 14:30 Downloaded contract #AGR-012 (logged)            │
│ 14:25 Viewed finance overview                          │
└─────────────────────────────────────────────────────────┘
```

**Rules:** No create/edit/delete anywhere. Document downloads allowed only if grant includes it, and every download is logged. All actions appear in `/platform/audit` for Super Admin.

---

### Portal 16 — Vehicle Seller / Dealer
**Purpose:** Lists vehicles for sale, manages inquiries, creates installment offers.

**Sidebar:**
```
Listings     ← home
Inquiries
Quotes
Orders
Installments
Trade-ins
──────────────
Profile
Verification
Support
```

**Home page `/seller`:**
```
┌─────────────────────────────────────────────────────────┐
│ My Listings                         [+ New listing]     │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Active 5     │ Inquiries 12 │ Orders 3     │ Revenue    │
│              │  (3 new) 🔴  │              │ RWF 12.4M  │
├─────────────────────────────────────────────────────────┤
│ LISTINGS                                                │
│ [photo] Toyota Hiace 2021 · RWF 14,500,000              │
│ Status: Published ✓  Inquiries: 4  [Edit] [Archive]    │
│                                                         │
│ [photo] BYD Atto 3 2024 · RWF 28,000,000                │
│ Status: Published ✓  Inquiries: 2  [Edit] [Archive]    │
├─────────────────────────────────────────────────────────┤
│ RECENT INQUIRIES                                        │
│ Alice K. → Toyota Hiace  "Can I get installments?"  [Reply]│
│ Jean M.  → BYD Atto 3    "Is price negotiable?"     [Reply]│
└─────────────────────────────────────────────────────────┘
```

---

### Portal 17 — Service Provider
**Purpose:** Lists services (GPS installation, tyre, maintenance), manages bookings.

**Sidebar:**
```
My Services  ← home
Bookings
Availability
Profile
Verification
Reviews
Payouts
Support
```

**Home page `/provider`:**
```
┌─────────────────────────────────────────────────────────┐
│ Kigali Tyre Works                    [+ Add service]    │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Services 4   │ Bookings today│ Rating ⭐4.8 │ Earnings   │
│              │ 3            │              │ RWF 240k   │
├─────────────────────────────────────────────────────────┤
│ TODAY'S BOOKINGS                                        │
│ 09:00 GPS installation — RAB 123 A  [Confirm] [Decline]│
│ 11:00 Tyre replacement — RAC 003 C  ✓ Confirmed        │
│ 14:30 Oil change — RAD 004 D        ✓ Confirmed        │
├─────────────────────────────────────────────────────────┤
│ MY SERVICES                                             │
│ GPS Installation · RWF 25,000 · [Edit]                 │
│ Tyre replacement · RWF 15,000–45,000 · [Edit]          │
│ Oil change · RWF 12,000 · [Edit]                       │
│ Verification: ✓ Verified by platform                   │
└─────────────────────────────────────────────────────────┘
```

---

### Portal 18 — Platform Support Agent
**Purpose:** Handles support tickets. Limited view of company accounts (audited, time-bounded).

**Sidebar:**
```
Ticket Queue ← home
My tickets
Escalations
Knowledge base
Contacts
```

**Home page `/platform/support`:**
```
┌─────────────────────────────────────────────────────────┐
│ Support Queue                          [SUPPORT AGENT]  │
│ ⚠ Viewing support context — access logged               │
├──────────────┬──────────────┬──────────────────────────┤
│ Open 12      │ My tickets 4 │ Escalated 2              │
├─────────────────────────────────────────────────────────┤
│ OPEN TICKETS                                            │
│ #TKT-042 · BILLING · HIGH                               │
│ "We were charged twice for October"                     │
│ Kigali Motors Ltd · 2h ago  [Take] [Escalate]          │
│                                                         │
│ #TKT-041 · TECHNICAL · MEDIUM                           │
│ "GPS device offline for 3 days"                         │
│ Express Rides · 5h ago  [Take] [Escalate]              │
├─────────────────────────────────────────────────────────┤
│ CUSTOMER PANEL (support context only)                   │
│ Kigali Motors Ltd — Business plan — Rwanda              │
│ Contact: info@kigalimotors.rw                          │
│ Account created: 01 Aug 2026                           │
│ Tickets: 3 total, 1 open                               │
│ ⚠ No financial, documents, or operational data shown   │
└─────────────────────────────────────────────────────────┘
```

---

## Part 3 — Sidebar by Role (Quick Reference)

| Route | SA | AD | FM | FIN | DRV | DISP | HR | MECH | COMP | RENT |
|-------|----|----|----|----|-----|------|----|----|------|------|
| /platform | ✓ | | | | | | | | | |
| /dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /map | ✓ | ✓ | ✓ | | | ✓ | | | | |
| /vehicles | ✓ | ✓ | ✓ | | | ✓ | | | | ✓ |
| /drivers | ✓ | ✓ | ✓ | | | ✓ | | | | |
| /dispatch | ✓ | ✓ | ✓ | | | ✓ | | | | |
| /alerts | ✓ | ✓ | ✓ | | | ✓ | | | ✓ | |
| /geofences | ✓ | ✓ | ✓ | | | | | | | |
| /maintenance | ✓ | ✓ | ✓ | | | | | | | |
| /workshop | ✓ | ✓ | ✓ | | | | | ✓ | | |
| /compliance | ✓ | ✓ | ✓ | | | | | | ✓ | |
| /rentals | ✓ | ✓ | | | | | | | | ✓ |
| /customers | ✓ | ✓ | ✓ | ✓ | | | | | | ✓ |
| /agreements | ✓ | ✓ | ✓ | ✓ | | | | | | ✓ |
| /finance | ✓ | ✓ | | ✓ | | | | | | |
| /approvals | ✓ | ✓ | | ✓ | | | | | | |
| /reports | ✓ | ✓ | ✓ | ✓ | | | | | | |
| /staff | ✓ | ✓ | | | | | ✓ | | | |
| /documents | ✓ | ✓ | ✓ | ✓ | | | | | ✓ | |
| /owner | ✓ | ✓ | | | ✓ | | | | | |
| /users | ✓ | ✓ | | | | | | | | |
| /settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| /support | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**SA=Super Admin, AD=Admin, FM=Fleet Manager, FIN=Finance Manager, DRV=Driver, DISP=Dispatcher, HR=HR Manager, MECH=Mechanic, COMP=Compliance Officer, RENT=Rental Manager**

---

## Part 4 — Build Status Summary

### Fully built (production-ready):
- SUPER_ADMIN portal + platform page (4 tabs)
- ADMIN/COMPANY_OWNER dashboard
- FLEET_MANAGER dashboard + live map + vehicles + drivers + alerts + geofences + maintenance
- FINANCE_MANAGER finance page
- DRIVER dashboard
- Register/login/pending-approval/rejected flows
- Support ticket system + contacts management

### Built but needs more pages:
- DISPATCHER — `/dispatch` page needs to be completed (trip board built in backend, frontend page needed)
- VEHICLE_OWNER — `/owner` page needs to be built (backend added `ownerUserId`)
- Platform — needs Plans/Audit/Health tabs added

### Not yet built (Phase B-D):
- `/rider` — Rider portal
- `/customer` — Customer portal
- `/rentals` — Rental manager page
- `/workshop` — Mechanic work orders
- `/compliance` — Compliance dashboard
- `/staff` — HR manager
- `/approvals` — Approval inbox
- `/seller` — Vehicle seller
- `/provider` — Service provider
- `/audit-view` — Auditor read-only view
- `/account/contexts` — Multi-context switcher

---

*This document is the design spec for every portal in ARTIC VMS.*
*Use it to build each page — each portal section has the exact layout, sidebar, and key pages.*
