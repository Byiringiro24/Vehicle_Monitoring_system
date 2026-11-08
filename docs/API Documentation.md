# ARTIC VMS — REST API Documentation

**Base URL:** `https://articvms.ddnsgeek.com/api/v1`
**Authentication:** Bearer JWT token (`Authorization: Bearer <accessToken>`)
**Content-Type:** `application/json`

---

## Authentication

### Login
```
POST /auth/login
Body: { "email": "admin@artic.io", "password": "Admin1234!" }
Response: { "accessToken": "...", "refreshToken": "...", "user": { id, email, firstName, lastName, role, phone, organization: { id, name, slug, status } } }
```

### Register Company
```
POST /auth/register
Body: { "orgName", "firstName", "lastName", "email", "password", "country" }
Response: { "accessToken", "refreshToken", "user": {...}, "orgStatus": "PENDING" }
```

### Register Personal Account
```
POST /auth/register-personal
Body: { "firstName", "lastName", "email", "password", "phone?", "intendedRole": "owner"|"driver"|"customer" }
Response: { "accessToken", "refreshToken", "user": {...}, "intendedRole": "owner" }
```

### SSO (Single Sign-On for external projects)
```
POST /auth/sso
Body: { "email", "password" }
Response: { "redirectUrl": "https://articvms.ddnsgeek.com/sso?token=xxx", "expiresIn": 60, "user": {...} }
```
Redirect the user to `redirectUrl` — they land on ARTIC VMS already logged in.

### Exchange SSO Token
```
POST /auth/sso/exchange
Body: { "token": "xxx" }
Response: { "accessToken", "refreshToken", "user": {...} }
```

### Refresh Token
```
POST /auth/refresh
Body: { "refreshToken": "..." }
Response: { "accessToken": "..." }
```

### Get Current User
```
GET /auth/me
Response: { id, email, firstName, lastName, role, phone, organization: { id, name, slug, status } }
```

### Change Password
```
POST /auth/change-password
Body: { "currentPassword", "newPassword" }
```

### Forgot Password
```
POST /auth/forgot-password
Body: { "email" }
```

### Reset Password
```
POST /auth/reset-password
Body: { "token", "newPassword" }
```

### Sessions
```
GET    /auth/sessions          — list active sessions
DELETE /auth/sessions/:id      — revoke one session
DELETE /auth/sessions          — revoke all other sessions (body: { currentToken })
```

### Switch Organization
```
POST /auth/switch-organization
Body: { "organizationId" }
```

---

## Vehicles

```
GET    /vehicles               — list (params: page, limit, search, fleetId, status)
GET    /vehicles/:id            — detail
POST   /vehicles                — create (SUPER_ADMIN, ADMIN, FLEET_MANAGER)
PUT    /vehicles/:id            — update
DELETE /vehicles/:id            — delete (SUPER_ADMIN, ADMIN)
POST   /vehicles/:id/regenerate-token
PATCH  /vehicles/:id/lock       — engine lock/unlock (body: { locked: true })
POST   /vehicles/:id/gps-ping   — ping GPS device
GET    /vehicles/:id/gps-history — GPS path (params: from, to)
GET    /vehicles/:vehicleId/trips
```

---

## Drivers

```
GET    /drivers                — list
POST   /drivers                — create (5-step wizard data)
PATCH  /drivers/:id/assign     — assign vehicle (body: { vehicleId })
GET    /drivers/:id/activity    — driver activity
```

---

## Trips / Dispatch

```
GET    /trips                   — list (params: status, vehicleId, driverId, date)
POST   /trips                   — create (body: vehicleId, scheduledAt, purpose, notes)
PATCH  /trips/:id/assign        — assign driver+vehicle (with conflict detection)
PATCH  /trips/:id/status        — update status (UNASSIGNED, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED)
DELETE /trips/:id               — cancel trip
```

---

## Alerts

```
GET    /alerts                  — list (params: status, severity, type, vehicleId)
PATCH  /alerts/:id/acknowledge
PATCH  /alerts/:id/resolve
GET    /alerts/rules            — list alert rules
POST   /alerts/rules            — create rule
DELETE /alerts/rules/:id
```

---

## Geofences

```
GET    /geofences               — list
POST   /geofences               — create
PUT    /geofences/:id           — update
DELETE /geofences/:id
GET    /geofences/:id/events     — events
PATCH  /geofences/:id/vehicles   — assign vehicles
```

---

## Finance

```
GET    /financial/dashboard             — P&L summary
GET    /financial/vehicle-profitability  — per-vehicle profit
GET    /financial/cash-flow             — cash flow records
GET    /financial/statement              — financial statement
GET    /financial/driver-payments        — driver payroll
POST   /financial/driver-payments        — create payment
PATCH  /financial/driver-payments/:id/mark-paid
```

---

## Invoices

```
GET    /invoices                — list
POST   /invoices                — create (body: customerId, description, amount, dueDate)
PATCH  /invoices/:id/mark-paid  — mark as paid
DELETE /invoices/:id            — cancel
```

---

## Payouts (Owner payout approval workflow)

```
GET    /payouts                 — list (params: status)
POST   /payouts                 — request payout (body: ownerId, amount, periodFrom, periodTo)
PATCH  /payouts/:id/approve     — approve (separation of duties enforced)
PATCH  /payouts/:id/execute      — mark as executed/paid
PATCH  /payouts/:id/reject       — reject with reason
```

---

## Contracts

```
GET    /contracts/customers     — list customers
POST   /contracts/customers     — create customer
PUT    /contracts/customers/:id — update
GET    /contracts/contracts     — list contracts
GET    /contracts/contracts/:id — detail
POST   /contracts/contracts     — create
PUT    /contracts/contracts/:id — update
GET    /contracts/contracts/:id/payments  — payment schedule
POST   /contracts/contracts/:id/payments  — add payment
PATCH  /contracts/payments/:id/mark-paid
```

---

## Agreements (Business Model Builder)

```
GET    /agreements/business-models  — list models
POST   /agreements/business-models  — create model
GET    /agreements                    — list agreements
GET    /agreements/:id                — detail
POST   /agreements                    — create
POST   /agreements/:id/activate       — activate + generate schedule
PATCH  /agreements/:id                — update
GET    /agreements/:id/payments       — payment schedule
POST   /agreements/:id/payments       — record payment
```

---

## Expenses

```
GET    /expenses              — list
POST   /expenses              — create
PUT    /expenses/:id          — update
DELETE /expenses/:id          — delete
GET    /expenses/summary      — summary by category
```

---

## Owner Portal

```
GET    /owner/vehicles        — vehicles owned by current user
GET    /owner/statements      — monthly income/expense statements
PATCH  /owner/vehicles/:id/claim  — claim ownership of a vehicle
```

---

## Remittances (Rider daily payments)

```
GET    /remittances/today     — today's remittance status
GET    /remittances           — history (params: months)
POST   /remittances           — record payment (body: amount, method?, notes?)
```

---

## Maintenance

```
GET    /maintenance           — list records
GET    /maintenance/:id       — detail
POST   /maintenance           — create
PUT    /maintenance/:id       — update
DELETE /maintenance/:id       — delete
GET    /maintenance/upcoming  — upcoming schedule
```

---

## Documents

```
GET    /documents             — list
GET    /documents/compliance  — compliance dashboard
GET    /documents/:id         — detail
POST   /documents             — create slot
PUT    /documents/:id         — update
POST   /documents/:id/verify  — verify (SUPER_ADMIN, ADMIN, FLEET_MANAGER)
POST   /documents/:id/reject  — reject with reason
DELETE /documents/:id
POST   /documents/:id/upload  — upload file (multipart)
POST   /documents/upload-and-create  — create + upload in one step
```

---

## Users

```
GET    /users                 — list users in org
GET    /users/all             — list all users (SUPER_ADMIN only)
POST   /users                 — create user (SUPER_ADMIN, ADMIN)
PUT    /users/:id             — update user
POST   /users/:id/reset-password  — force reset (SUPER_ADMIN only)
PATCH  /users/:id/status      — activate/deactivate
POST   /users/invite          — invite by email (sends setup link)
```

---

## Platform (Super Admin only)

```
GET    /platform/stats                    — platform KPIs
GET    /platform/organizations            — all companies
GET    /platform/organizations/:id         — company detail
POST   /platform/organizations/:id/subscription  — activate plan
GET    /platform/plans                    — list plans
POST   /platform/plans                    — create plan
PUT    /platform/plans/:id                — update plan
GET    /platform/audit-logs               — audit logs
```

---

## Support

```
GET    /support/contacts                  — public, no auth needed
POST   /support/tickets                   — submit ticket (public)
GET    /support/my-tickets                — user's own tickets
GET    /support/admin/tickets             — all tickets (SUPER_ADMIN)
PATCH  /support/admin/tickets/:id         — update ticket
GET    /support/admin/pending-orgs        — pending registrations
POST   /support/admin/orgs/:id/approve    — approve org
POST   /support/admin/orgs/:id/reject     — reject org
PUT    /support/admin/contacts            — update all contacts
PATCH  /support/admin/contacts/:id        — update one contact
```

---

## Audit Log

```
GET    /audit                — org-level logs (SUPER_ADMIN, ADMIN)
GET    /audit/platform       — all platform logs (SUPER_ADMIN)
```

---

## Entitlements (Feature flags)

```
GET    /entitlements              — list this org's enabled features
GET    /entitlements/check/:code  — check if a feature is enabled
POST   /entitlements              — grant feature (SUPER_ADMIN)
DELETE /entitlements/:id          — revoke feature (SUPER_ADMIN)
```

---

## Notifications

```
GET    /notifications/preferences              — get user's alert prefs
PUT    /notifications/preferences              — bulk update
PATCH  /notifications/preferences/:type        — toggle one alert type
```

---

## Moto Fleet (Boda-boda / E-moto)

All routes require authentication. Roles: SUPER_ADMIN, ADMIN, FLEET_MANAGER, FINANCE_MANAGER, DISPATCHER (write). All roles can read.

### Drivers

```
GET    /moto/drivers
  params: status, plate, search, active (true|false)
  Returns: enriched list with hasBike, todayStatus, todayPaid, unpaidDays, totalDebt, finesCount

GET    /moto/drivers/:id
  Returns: driver + payments[] (last 90 days) + fines[] (last 50) + summary stats

POST   /moto/drivers
  Body: { firstName*, lastName*, phone*, altPhone?, nationalId?, licenseNumber?, licenseClass?,
          address?, referral1Name?, referral1Phone?, referral2Name?, referral2Phone?,
          plateNumber?, bikeModel?, dailyRate? (default 6000), weeklyRate? (default 42000),
          paymentType? (DAILY|WEEKLY|MONTHLY), paymentDeadline? (default "21:00"),
          status? (ACTIVE|INACTIVE|SUSPENDED), notes? }

PUT    /moto/drivers/:id
  Body: any subset of POST fields (partial update)

PATCH  /moto/drivers/:id/assign-bike
  Body: { plateNumber?, bikeModel? }
  Note: if plateNumber is already assigned to another driver, it is automatically transferred
        and that driver is set to INACTIVE
```

### Daily Payments

```
GET    /moto/payments
  params: date, from, to, driverId, plate, status, limit (max 500)
  Returns: payments[] with nested driver info

GET    /moto/payments/today
  Returns: { date, totalCollected, totalExpected, totalDebt, paidCount, debtCount,
             notRecorded, activeDrivers, payments[] }

POST   /moto/payments
  Body: { driverId*, date*, paidAmount?, paidViaPhone?, paidViaCash?, notes? }
  — paidAmount OR (paidViaPhone + paidViaCash) — one or the other
  — If paid < expected   → status=DEBT, shortfall added to driver totalDebt
  — If paid = 0          → status=DEBT, full rate added to driver totalDebt
  — If paid >= expected  → excess covers previous debt first, then status=PAID
  — Upserts: one record per (driverId, date)
  Returns: payment + { driverName, plateNumber, debtAfter, message }
```

### Garage Expenses

```
GET    /moto/garage
  params: from, to, plate, limit (max 500)
  Returns: { data: expenses[], total }

POST   /moto/garage
  Body: { product*, amount*, date?, plateNumber?, category? (MAINTENANCE|REPAIR|PART|TYRES|
          BATTERY|CLEANING|FUEL|BALANCE_CHECK|OTHER), notes? }
```

### Fines

```
GET    /moto/fines
  params: plate, driverId, from, to

POST   /moto/fines
  Body: { plateNumber*, reason*, amount*, fineDate?, driverId?, paidByCompany? (bool), notes? }
```

### Reports

```
GET    /moto/reports/summary
  params: from, to, driverId, plate
  Returns:
    period: { from, to }
    totals: { totalCollected, totalExpected, totalDebt, totalFines, totalGarage, net,
              paymentCount, daysCovered }
    byDay:  [ { date, collected, expected, debt } ]  — sorted asc
    fines:  MotoFine[]
    garage: GarageExpense[]
```

### Finance Dashboard — Moto KPIs

The `/financial/dashboard` endpoint now includes a `moto` object:
```json
"moto": {
  "todayCollected":  <RWF collected today from all moto drivers>,
  "monthCollected":  <RWF collected this month>,
  "monthGarage":     <garage expenses this month>,
  "monthFines":      <fines this month>,
  "monthNet":        <monthCollected - monthGarage - monthFines>,
  "totalDebt":       <sum of all driver totalDebt>,
  "activeDrivers":   <count of active drivers with a bike assigned>
}
```
Moto income is also merged into the top-level `today.income` and `month.income` figures.

---

## Attendance (HR)

```
GET    /attendance/my     — own records
GET    /attendance        — org-wide (SUPER_ADMIN, ADMIN, HR_MANAGER)
POST   /attendance        — check in
PATCH  /attendance/:id    — update / check out
```

---

## Health

```
GET    /health            — public liveness check
GET    /health/detailed   — full system health (SUPER_ADMIN)
```

---

## Devices (GPS commands)

```
POST   /devices/:vehicleId/command     — send command (lock, unlock, restart, ussd, ping)
PATCH  /devices/:vehicleId/sim          — update SIM number
PATCH  /devices/:vehicleId/data-plan    — update data plan
```

---

## 14 User Roles

| Role | Description |
|------|-------------|
| SUPER_ADMIN | Platform owner |
| PLATFORM_SUPPORT | Support tickets only |
| ADMIN | Company management |
| FLEET_MANAGER | Fleet operations |
| FINANCE_MANAGER | Full finance |
| DISPATCHER | Trip assignment |
| HR_MANAGER | Staff management |
| MECHANIC | Workshop |
| COMPLIANCE_OFFICER | Document verification |
| RENTAL_MANAGER | Rental calendar |
| SALES_AGENT | Vehicle sales |
| AUDITOR | Read-only |
| DRIVER | Drives vehicles (includes rider) |
| VIEWER | Personal accounts (owner/customer/seller/provider) |

---

## Rate Limits

- Auth endpoints: 20 requests per 15 minutes per IP
- Register: 5 per hour per IP
- API endpoints: 300 per minute per IP

---

*API documentation last updated: October 2026*
