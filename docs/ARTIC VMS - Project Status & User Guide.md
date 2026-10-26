# ARTIC VMS — Project Status, User Guide & Development Roadmap
**Last Updated:** October 2026  
**Server:** articvms.ddnsgeek.com · 185.208.207.100  
**Repository:** https://github.com/Byiringiro24/Vehicle_Monitoring_system

---

## 1. DEFAULT CREDENTIALS (Change immediately after first login)

> ⚠️ These are the seeded demo accounts. Change all passwords before sharing access with real users.

| Role | Email | Password | Can Access |
|---|---|---|---|
| **Super Admin** | admin@artic.io | Admin1234! | Everything — platform, all companies, all users |
| **Fleet Manager** | manager@artic.io | Manager1234! | Fleet, vehicles, drivers, GPS, maintenance, alerts |
| **Finance Manager** | finance@artic.io | Finance1234! | Finance, agreements, payments, customers, reports |

**To change a password after logging in:**  
Go to **Settings → Profile** or use the **Forgot Password** flow on the login page.

**To reset any user's password (Super Admin only):**  
Go to **Users → click the 🔑 key icon** next to any user → enter new password → confirm.

---

## 2. WHAT IS BUILT — COMPLETED FEATURES

### 2.1 Authentication & Security
- ✅ Login with email + password — dark branded login page
- ✅ Register new organization (company + admin account created in one step)
- ✅ Forgot password — secure email link (30-minute expiry, SHA-256 hashed token)
- ✅ Reset password — single-use link, invalidates all sessions on success
- ✅ Change password (self-service, requires current password)
- ✅ Super Admin force-reset any user's password
- ✅ JWT access tokens (15-min expiry) + refresh tokens (7-day expiry)
- ✅ Auto-logout on token expiry
- ✅ Rate limiting on login (20/15min) and registration (5/hour)

### 2.2 Role-Based Access Control
Every page, API endpoint, and action is protected by role. The system enforces access on the backend — hiding a menu item is not the security layer.

| Role | Home Page | Navigation |
|---|---|---|
| SUPER_ADMIN | /platform | Platform admin, all pages |
| ADMIN | /dashboard | All pages except Platform |
| FLEET_MANAGER | /dashboard | Fleet, maintenance, alerts, map, documents, agreements |
| FINANCE_MANAGER | /finance | Finance, agreements, customers, reports |
| DRIVER | /dashboard | Dashboard (own vehicle only), profile, documents |
| VIEWER | /dashboard | Dashboard (read-only), map, vehicles, alerts |

### 2.3 GPS Tracking & Live Map
- ✅ Real-time GPS via MQTT (ESP32 + Air780E/SIM808 hardware)
- ✅ Live map with vehicle markers, speed, heading, fuel level
- ✅ Satellite map toggle (🗺️ / 🛰️)
- ✅ Location search bar — find any address or GPS coordinates
- ✅ GPS history replay — view a vehicle's route for any time period
- ✅ Engine lock/unlock via MQTT relay (requires plate confirmation)
- ✅ GPS ping — test if a device is online
- ✅ Vehicle online/offline detection (30-second threshold)
- ✅ MQTT broker (Aedes) + client bridge
- ✅ SIM data plan tracking with expiry alerts

### 2.4 Vehicles
- ✅ Full vehicle registration: 70+ fields (identity, classification, energy, insurance, permits, documents)
- ✅ Support for petrol, diesel, electric, hybrid, and all vehicle types
- ✅ Fleet grouping with colored tags
- ✅ Vehicle detail page with 5 tabs: Overview, GPS History, Telemetry, Device Commands, Documents
- ✅ Vehicle list with search, status filter, engine lock toggle, pagination
- ✅ Real-time status (ACTIVE/IDLE/OFFLINE) based on GPS activity

### 2.5 Drivers
- ✅ 5-step driver registration wizard: Personal → License → Employment → Health → Banking
- ✅ Full profile: license details, expiry, experience types, blood group, bank/mobile money
- ✅ Vehicle assignment and reassignment
- ✅ Driver cards with license expiry warning

### 2.6 Alerts
- ✅ 17 alert types: speeding, geofence breach, low fuel, engine overheat, offline, harsh braking, etc.
- ✅ Severity levels: CRITICAL, HIGH, MEDIUM, LOW
- ✅ Real-time alerts via Socket.IO (toast notification on screen)
- ✅ Acknowledge and resolve alerts
- ✅ Filters by status and severity
- ✅ Search alerts by title, message, vehicle plate
- ✅ Alert rules — configurable speed limits, fuel thresholds, etc.

### 2.7 Geofences
- ✅ Draw polygon or circle zones on the map
- ✅ Entry/exit alerts
- ✅ Assign to specific vehicles or all vehicles
- ✅ Geofence event history

### 2.8 Maintenance
- ✅ Log service records (type, cost, mileage, garage, mechanic)
- ✅ Upcoming maintenance view — vehicles due in next 30/60 days
- ✅ Days-left badges (green/amber/red)
- ✅ Automatic expiry tracking for insurance, inspection, road tax
- ✅ Updates vehicle's lastServiceDate and nextServiceDate

### 2.9 Documents
- ✅ Upload documents per vehicle, driver, user, or organization
- ✅ 20 document categories: insurance, registration, license, ID, passport, etc.
- ✅ Verification workflow: Pending → Verified / Rejected
- ✅ Expiry tracking with automatic email reminders (30 days, 7 days before expiry)
- ✅ Compliance dashboard: missing, expiring, pending, verified documents
- ✅ Secure file storage in /uploads with SHA-256 integrity check

### 2.10 Finance & Agreements
- ✅ Configurable vehicle business models (daily rental, weekly, monthly, hire-purchase, lease-to-own, etc.)
- ✅ Create agreements with auto-generated payment schedules
- ✅ Record payments against schedule (Cash, Mobile Money, Bank, Card)
- ✅ Overdue payment escalation (daily job)
- ✅ Overdue payment email reminders to customers
- ✅ Finance dashboard: today/month P&L, outstanding, top customers
- ✅ Old-style contracts (rental, lease, installment sale)
- ✅ Driver payroll tracking (salary, commission, bonus, deductions)
- ✅ Vehicle expense recording (20 categories)
- ✅ Financial reports: income statement, cash flow, profitability per vehicle

### 2.11 Customers
- ✅ Customer CRM: contact, address, national ID, credit score
- ✅ Customer detail page showing all agreements and payment history
- ✅ Emergency contact, guarantor, employer info

### 2.12 Reports
- ✅ 5-tab reports: Summary, Fleet, Vehicle Profitability, Driver Payments, Financial Statements
- ✅ Date range filters on all reports
- ✅ CSV export on all report tabs
- ✅ Monthly income vs expenses chart
- ✅ Expense breakdown pie chart
- ✅ Alerts by type bar chart

### 2.13 Users & Organization
- ✅ User list with role badges, status, last login
- ✅ Create users, set roles, activate/deactivate
- ✅ SUPER_ADMIN: see all users across all organizations
- ✅ Settings page with 4 tabs: Organization, Subscription, Alert Rules, Members
- ✅ Subscription plan display (trial/active status, seats used)

### 2.14 Platform Admin (SUPER_ADMIN only)
- ✅ See all registered companies with subscription status
- ✅ Activate plans for companies (Free, Starter, Business, Enterprise)
- ✅ Grant/revoke feature entitlements per company
- ✅ Platform KPIs: total companies, users, vehicles
- ✅ Audit log

### 2.15 Email (SMTP)
- ✅ Welcome email on registration
- ✅ Password reset email (30-min secure link)
- ✅ Password changed confirmation
- ✅ Overdue payment reminders
- ✅ Document expiry warnings
- ✅ Gmail App Password configured (byiringirofabrice6@gmail.com)

### 2.16 Infrastructure
- ✅ Deployed on Contabo VPS (Ubuntu 24.04, 6 vCPU, 12 GB RAM)
- ✅ Docker Compose (backend, frontend, PostgreSQL, Redis)
- ✅ Nginx reverse proxy with HTTPS
- ✅ Let's Encrypt SSL certificate (expires Jan 2027, auto-renews)
- ✅ Database backup script (daily, keeps 30 backups)
- ✅ UFW firewall (ports 22, 80, 443, 1883 only)

---

## 3. WHAT EACH ROLE SEES IN THE PORTAL

### 3.1 SUPER_ADMIN / ADMIN — Full Command Center
**Dashboard shows:**
- 5 KPI cards: Total vehicles, Moving, Idle, Offline, Active alerts
- Live fleet map with all vehicles
- Recent alerts panel
- Fleet status bars (% of fleet in each state)
- Finance snapshot (monthly income, expenses, profit)
- Maintenance (overdue, due today, upcoming)
- Quick actions: Add Vehicle, Add Driver, Live Map, Reports, Users, Finance
- 7-day vehicle activity line chart
- System health status (GPS, MQTT, server, database)

**Can do:** Everything — add vehicles, lock engines remotely, manage all users, view all financial data, configure alert rules, access platform admin panel.

### 3.2 FLEET_MANAGER — Operations Focus
**Dashboard shows:**
- 4 KPI cards: Total vehicles, Moving, Idle, Active alerts
- Full-width live fleet map (primary workspace)
- Active alerts panel (click to highlight vehicle on map)
- Upcoming maintenance panel with days-left badges

**Can do:** Manage vehicles and drivers, view GPS tracking, acknowledge alerts, log maintenance, manage documents, create agreements with customers. **Cannot** see financial statements or platform admin.

### 3.3 FINANCE_MANAGER — Financial Focus
**Dashboard shows:** (no GPS map)
- Today's income, expenses, profit
- Monthly KPI cards + outstanding balance
- Monthly cost breakdown bar chart
- Active agreements list with overdue flags
- Top paying customers
- Compliance alerts (insurance/road tax expiring)

**Can do:** View and create agreements, record payments, manage customers, view all financial reports. **Cannot** manage vehicles, drivers, or GPS devices.

### 3.4 DRIVER — Personal View Only
**Dashboard shows:**
- Assigned vehicle with live telemetry (speed, fuel, km today, engine status)
- Live location address
- License expiry warning (shown 60 days before expiry)
- Own driver details (license number, status)

**Can do:** View their own profile, upload their documents (license, ID, medical cert), view the vehicle assigned to them. **Cannot** see other drivers, vehicles, or any financial data.

### 3.5 VIEWER — Read-Only Summary
**Dashboard shows:**
- 4 status chips (total vehicles, moving, idle, alerts)
- Full-width live map
- Fleet status bars
- Recent alerts (no action buttons)

**Can do:** View map, alerts, and vehicles. **Cannot** edit anything, create anything, or see financial data.

---

## 4. WHAT STILL NEEDS TO BE BUILT

### Priority 1 — Complete the gaps (important for production)

| Item | Description |
|---|---|
| Reports: Daily Payments grid | The backend already generates a per-vehicle daily payment spreadsheet (`GET /reports/daily-payments`) but there is no frontend tab for it yet. This is the most useful report for fleet owners tracking daily collections. |
| Vehicles: fix ConfirmDialog on delete | Currently uses `confirm()` (native browser popup). Should use the existing `ConfirmDialog` component for consistency. |
| Vehicles: GPS Activity table shows raw UUIDs | The "GPS Activity Summary" in reports shows vehicle IDs instead of plate numbers. Needs a join or lookup. |
| Reports: Driver tab date range mismatch | Driver payments tab filters by year only, while all other tabs use a full date range. |
| Organization: edit profile UI | Settings shows org info but the PUT /organizations/me endpoint exists — there's no edit form to use it. |
| Input validation on org PUT | `PUT /organizations/me` passes req.body directly to Prisma — should validate allowed fields. |

### Priority 2 — Significant features for a full SaaS

| Item | Description |
|---|---|
| Document file uploads to cloud | Currently files are stored in `/uploads` on the container filesystem. A server restart keeps them but Docker volume is not permanent storage — needs S3-compatible object storage (MinIO, Cloudflare R2, or AWS S3) for production |
| Invoice generation (PDF) | Customers and agreements need PDF invoices. Requires a library like `pdfkit` or `puppeteer`. |
| Company registration approval flow | Currently a new organization is immediately active after registration. Add an "approval required" flow where Super Admin approves new companies. |
| Multi-company workspace switcher | Users can belong to multiple companies. The WorkspaceSwitcher component exists in the sidebar but context switching (changing the active org) requires a proper token-refresh flow. |
| Staff invitation via email | Admins can invite new users, but the invitation email is just a welcome email — no invitation token with a password-setup link. |
| MFA (multi-factor authentication) | Login currently only uses email + password. No TOTP/SMS second factor. |
| Customer portal | Customers should be able to log in and see their own invoices, agreements, payment history, and tracking (where authorized). |
| Mobile driver app | Drivers currently use the same responsive web app. A dedicated mobile-optimized experience (or PWA) for trip acceptance, inspections, and photo uploads would be significantly better. |
| Preventive maintenance scheduler | Maintenance records exist but there's no automated alert when a vehicle reaches its service interval (e.g., every 5,000 km or every 6 months). |
| Automated overdue payment SMS | Currently sends emails for overdue payments. Many customers in Rwanda use mobile money and prefer SMS. Integrate Africa's Talking or Twilio SMS. |
| Double-entry accounting ledger | Current finance is "income minus expenses" — not a proper double-entry general ledger with chart of accounts, journal entries, and balance sheet. Important for formal accounting. |
| Fuel consumption anomaly detection | Flag vehicles whose fuel consumption is significantly above average (possible theft or siphoning). |
| Trip recording and proof of delivery | Structured trip start/end with photos and customer signature. |

### Priority 3 — Enterprise features (future)

| Item | Description |
|---|---|
| Subscription billing integration | Payment provider (MTN MoMo, Airtel Money, Stripe) to accept platform subscription payments |
| Public marketplace | Landing page where vehicle owners can list vehicles for management and customers can browse available rentals |
| Electronic contract signing | In-app contract creation with digital signature (currently just a text editor and file upload) |
| AI assistant | Natural language queries against fleet/finance data ("Which vehicles haven't been serviced in 3 months?") |
| PostGIS spatial queries | Currently GPS positions are stored as decimal lat/lng. PostGIS would allow efficient radius queries, trip distance calculations, and geofence containment at database level |
| Webhook integrations | Allow companies to receive events (new payment, geofence breach, vehicle offline) to their own systems |

---

## 5. DATABASE OVERVIEW

**Database:** PostgreSQL 16 · Name: `fleet_management` · User: `artic_user`

### Key tables:
- `organizations` — companies using the platform
- `users` — all user accounts (one account per person, many roles possible)
- `memberships` — links users to organizations with roles
- `vehicles` — full vehicle records with 70+ fields
- `drivers` — driver profiles linked to user accounts
- `gps_devices` — GPS hardware per vehicle
- `telemetry` — raw GPS history (every 2 seconds from device)
- `last_locations` — current position per vehicle (fast map queries)
- `trips` — recorded journeys
- `alerts` / `alert_rules` — alert events and configuration
- `geofences` / `geofence_events` — zone definitions and breach events
- `maintenance_records` — service history
- `documents` — uploaded files with metadata and verification
- `agreements` — vehicle contracts (rental, hire-purchase, etc.)
- `scheduled_payments` — auto-generated payment due dates
- `payment_records` — actual payments received
- `vehicle_contracts` — legacy contract system (rental/leasing)
- `contract_payments` — payments on legacy contracts
- `vehicle_expenses` — operating costs
- `fuel_records` — fuel purchase records
- `plans` / `subscriptions` / `entitlements` — SaaS billing layer
- `password_reset_tokens` — secure password recovery
- `audit_logs` — sensitive action tracking

---

## 6. ESP32 HARDWARE

**Supported hardware:**
- ESP32 DevKit (any variant)
- Air780E LTE module (primary) OR SIM808/SIM800L GPRS
- GT-U7 / NEO-6M GPS module

**MQTT connection:** `articvms.ddnsgeek.com:1883`  
**Authentication:** Each vehicle has a unique `deviceToken` (UUID) used as the MQTT topic prefix  
**Topic:** `artic/<deviceToken>/telemetry`  
**Commands from server:** `artic/<deviceToken>/lock`, `artic/<deviceToken>/ping`

**Firmware files are in:** `esp32_Codeess/` folder — multiple versions  
**Latest working version:** `esp32_Codeess_22_07_2026.ino` or `esp32_air780e_gtu7_v1.ino`

---

## 7. QUICK REFERENCE — IMPORTANT URLS

| URL | Purpose |
|---|---|
| https://articvms.ddnsgeek.com | Main dashboard (login required) |
| https://articvms.ddnsgeek.com/register | Register a new company |
| https://articvms.ddnsgeek.com/forgot-password | Password reset |
| https://articvms.ddnsgeek.com/platform | Super Admin panel |
| https://articvms.ddnsgeek.com/api/v1/health | API health check |

---

## 8. IMPORTANT SECURITY NOTES

- **Never share the Super Admin credentials** with anyone who doesn't need full platform control
- **Change all default passwords** before going live with real vehicles/customers
- **The Gmail App Password** (`advlaszqtqwbybwc`) grants email-sending access — keep it secret, rotate it if compromised
- **The JWT secrets** in the server `.env` file must remain secret — anyone with these can forge login tokens
- **The `deviceToken` for each vehicle** is the password for that vehicle's MQTT connection — regenerate it if a device is stolen
- **Root SSH login** to the server should remain disabled — always use `articadmin` with the SSH key
