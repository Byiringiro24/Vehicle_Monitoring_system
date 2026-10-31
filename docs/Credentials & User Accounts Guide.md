# ARTIC VMS — Credentials & User Accounts Guide
**Last updated:** October 2026
**System:** articvms.ddnsgeek.com (185.208.207.100)

---

## IMPORTANT — How Passwords Are Stored

Passwords in ARTIC VMS are **never stored in plain text**. Every password is hashed using **bcryptjs** with a cost factor of 12 before being saved to the database. This means:

- The database contains a `passwordHash` string, not the password itself
- Nobody — including the Super Admin — can read a user's password from the database
- The only way to "recover" a forgotten password is to reset it (never retrieve it)
- Super Admin can force-reset any user's password via `/users` → reset button (no old password needed)
- Password reset emails use a one-time SHA-256 hashed token stored in `password_reset_tokens` table — the raw token is only ever sent by email, never stored

**Password requirements:** minimum 8 characters. No maximum. All characters allowed.

---

## SECTION 1 — Seed / Demo Accounts (Created by `npm run seed`)

These accounts are created automatically when you run the database seed script on a fresh installation. They exist in the **"ARTIC Demo Organization"** (`slug: artic-demo`).

| Role | Email | Password | Name |
|------|-------|----------|------|
| SUPER_ADMIN | `admin@artic.io` | `Admin1234!` | System Administrator |
| FLEET_MANAGER | `manager@artic.io` | `Manager1234!` | Fleet Manager |
| FINANCE_MANAGER | `finance@artic.io` | `Finance1234!` | Finance Manager |

**To run the seed:**
```bash
cd backend
npm run seed
```

**To reset seed accounts on server:**
```bash
ssh articadmin@185.208.207.100
cd /home/articadmin/artic-vms
docker compose exec backend npm run seed
```

---

## SECTION 2 — Production Super Admin Account

The live system on `articvms.ddnsgeek.com` has a Super Admin account that was created when the seed was first run on the server. If you changed the password after seeding, the seed password below may no longer be valid — use the force-reset route instead.

| Field | Value |
|-------|-------|
| Email | `admin@artic.io` |
| Seed password | `Admin1234!` |
| Role | `SUPER_ADMIN` |
| Organization | ARTIC Demo Organization |
| Dashboard | `https://articvms.ddnsgeek.com/platform` |

**If locked out of Super Admin — reset via database:**
```bash
ssh articadmin@185.208.207.100
cd /home/articadmin/artic-vms
docker compose exec backend node -e "
const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
bcrypt.hash('NewPassword123!', 12).then(hash =>
  prisma.user.update({where:{email:'admin@artic.io'},data:{passwordHash:hash}})
).then(()=>{ console.log('done'); prisma.\$disconnect(); });
"
```

---

## SECTION 3 — How Companies Register and Get Accounts

### 3a. Company Registration Flow

1. A company representative visits `https://articvms.ddnsgeek.com/register`
2. They fill in: company name, first name, last name, email, country, password
3. The system creates:
   - An `Organization` record with `status: PENDING`
   - A `User` record with `role: ADMIN` linked to that organization
   - A `Membership` record with `role: COMPANY_ADMIN`
4. The user is auto-logged in but lands on `/pending-approval` (not the dashboard)
5. Super Admin receives an email notification and reviews at `/platform` → Pending tab
6. Super Admin approves → organization `status` becomes `ACTIVE` → welcome email sent to company admin
7. Company admin can now log in and access their full dashboard

### 3b. Staff / Team Member Accounts

Company admins create staff accounts in two ways:

**Method 1 — Direct create (sets password immediately):**
- `/users` → + Add user → enter email, name, role, temporary password
- User signs in with that temporary password and changes it via `/settings` → Security

**Method 2 — Invite by email (new feature):**
- `/users` → Invite → enter email + role → system sends a setup email
- If the email is new: user gets a link to set their own password
- If the email already has an account: their role is updated and they get a notification email
- Setup links expire after 72 hours

### 3c. Personal Accounts (Driver / Owner / Customer)

1. User visits `/register` → selects "Create a Personal Account"
2. Selects role: Vehicle Owner, Driver/Rider, or Customer
3. Fills in: first name, last name, email, optional phone, password
4. A personal organization is automatically created (inactive, not shown in platform list)
5. User is redirected to `/onboarding` to complete their profile

---

## SECTION 4 — All User Roles

### Platform Level

| Role | Code | Description | Landing page |
|------|------|-------------|--------------|
| Super Admin | `SUPER_ADMIN` | Owns the ARTIC VMS platform. Approves companies, manages plans, configures support contacts, views all audit logs | `/platform` |

### Company Level (one org, multiple members)

| Role | Code | Description | Landing page |
|------|------|-------------|--------------|
| Company Admin | `ADMIN` | Full org management — users, settings, roles, invitations, vehicles, drivers | `/dashboard` |
| Fleet Manager | `FLEET_MANAGER` | Manages vehicles, GPS tracking, drivers, alerts, geofences, maintenance, documents | `/dashboard` |
| Finance Manager | `FINANCE_MANAGER` | Full financial access: agreements, payments, expenses, reports, owner statements | `/finance` |
| Dispatcher | `DISPATCHER` | Assigns drivers to trips, sees live map and vehicle/driver availability | `/dispatch` |
| HR Manager | `HR_MANAGER` | Staff profiles, qualifications, attendance, shifts, leave, documents | `/staff` |
| Mechanic | `MECHANIC` | Workshop work orders for assigned jobs only | `/workshop` |
| Compliance Officer | `COMPLIANCE_OFFICER` | Document verification, licence/permit expiry, compliance flags | `/compliance` |
| Rental Manager | `RENTAL_MANAGER` | Availability calendar, reservations, handovers, deposits, damage | `/rentals` |
| Driver | `DRIVER` | Assigned vehicle with live telemetry, trips, earnings, documents | `/dashboard` |
| Viewer | `VIEWER` | Read-only access to map, vehicles, alerts | `/dashboard` |

### Personal Level

| Role | Code | Description | Landing page |
|------|------|-------------|--------------|
| Personal (owner/customer/rider) | `VIEWER` | Personal accounts — see `/owner`, `/customer`, or `/rider` portal | `/dashboard` then redirected |

---

## SECTION 5 — What Each Role Can Access

### SUPER_ADMIN
**Can access:** Everything on `/platform` — company list, pending approvals, support tickets, contact links, subscription plans, audit logs, system health  
**Cannot access:** Individual company operational data (trips, customers, finances, documents) unless impersonating — which is a planned feature  
**Sidebar shows:** Platform, Dashboard, Map, Vehicles, Drivers, Dispatch, Alerts, Geofences, Maintenance, Finance, Reports, Documents, Users, Settings, Support

### ADMIN
**Can access:** Full dashboard, all operations, all finance, users management, settings  
**Cannot access:** Platform console (`/platform`)  
**Sidebar shows:** Dashboard, Map, Vehicles, Drivers, Dispatch, Alerts, Geofences, Maintenance, Finance, Approvals, Reports, Documents, Users, Settings, Support

### FLEET_MANAGER
**Can access:** Dashboard, Map, Vehicles, Drivers, Dispatch, Alerts, Geofences, Maintenance, Workshop, Compliance, Telemetry, Customers, Agreements, Reports, Documents  
**Cannot access:** Finance (will see ⛔ blocked icon), Users, Platform  
**Sidebar shows:** Dashboard, Map, Vehicles, Drivers, Dispatch, Alerts, Geofences, Maintenance, Workshop, Compliance, Telemetry, Customers, Agreements, Reports, Documents, Settings, Support

### FINANCE_MANAGER
**Can access:** Finance (full 6 tabs), Approvals, Customers, Agreements, Reports  
**Cannot access:** GPS/Map (⛔ blocked), Vehicles edit, Drivers  
**Sidebar shows:** Dashboard, Finance, Approvals, Customers, Agreements, Reports, Settings, Support

### DISPATCHER
**Can access:** Dispatch board, Live Map, Vehicles (view), Drivers (view), Alerts  
**Cannot access:** Finance, Documents, Maintenance, Users  
**Sidebar shows:** Dashboard, Map, Vehicles, Drivers, Dispatch, Alerts, Settings, Support

### HR_MANAGER
**Can access:** Staff/HR module  
**Cannot access:** Finance, GPS data, Vehicles edit  
**Sidebar shows:** Dashboard, Staff/HR, Documents, Settings, Support

### MECHANIC
**Can access:** Workshop (own work orders only)  
**Cannot access:** Finance, Customers, other vehicles outside assigned work orders  
**Sidebar shows:** Dashboard, Workshop, Settings, Support

### COMPLIANCE_OFFICER
**Can access:** Compliance dashboard, Documents review, Alerts  
**Cannot access:** Finance, Customers, Driver personal data  
**Sidebar shows:** Dashboard, Compliance, Alerts, Documents, Settings, Support

### RENTAL_MANAGER
**Can access:** Rentals, Customers, Agreements, Vehicles (rental view)  
**Cannot access:** Finance approvals, HR, Workshop  
**Sidebar shows:** Dashboard, Rentals, Vehicles, Customers, Agreements, Settings, Support

### DRIVER
**Can access:** Own dashboard (assigned vehicle, telemetry, trips, earnings, documents)  
**Cannot access:** Other vehicles, other drivers' data, finance, customers  
**Sidebar shows:** Dashboard, My Vehicles, Settings, Support

### VIEWER
**Can access:** Read-only — Map, Vehicles list, Alerts  
**Cannot access:** Finance, Drivers edit, Users, Documents  
**Sidebar shows:** Dashboard, Map, Vehicles, Alerts, My Vehicles, Settings, Support

---

## SECTION 6 — How Users Are Stored in the Database

### `users` table — key fields

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `email` | String UNIQUE | Login identifier. Always lowercase |
| `passwordHash` | String | bcryptjs hash (cost=12). Never the raw password |
| `firstName` | String | |
| `lastName` | String | |
| `role` | UserRole enum | One of the roles in Section 4 |
| `phone` | String? | Optional |
| `isActive` | Boolean | `false` = account deactivated, cannot log in |
| `lastLoginAt` | DateTime? | Updated on every successful login |
| `organizationId` | String | FK to `organizations.id` |
| `createdAt` | DateTime | Auto |

### `organizations` table — key fields

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Company name |
| `slug` | String UNIQUE | URL-safe identifier |
| `status` | OrgStatus enum | `PENDING` → `ACTIVE` → `REJECTED` / `SUSPENDED` |
| `rejectionReason` | String? | Set when status = REJECTED |
| `email` | String? | Company contact email |
| `country` | String | |

### `refresh_tokens` table

Stores one refresh token per active session. On logout or password change, all tokens for that user are deleted — ending all sessions.

| Column | Type | Description |
|--------|------|-------------|
| `token` | String UNIQUE | UUID v4 random token |
| `userId` | String | FK to users |
| `expiresAt` | DateTime | 7 days from creation |

### `password_reset_tokens` table

One active reset token per user at a time. Token is SHA-256 hashed — raw token only in the email.

| Column | Type | Description |
|--------|------|-------------|
| `tokenHash` | String UNIQUE | SHA-256(rawToken) |
| `userId` | String | FK to users |
| `expiresAt` | DateTime | 30 minutes from creation |
| `used` | Boolean | Set to true after use — cannot be reused |

---

## SECTION 7 — Authentication Flow

### Login
```
POST /api/v1/auth/login
Body: { email, password }
Returns: { accessToken, refreshToken, user }
```
- `accessToken`: JWT, expires in **15 minutes**. Contains: `userId`, `email`, `role`, `organizationId`
- `refreshToken`: UUID v4, expires in **7 days**. Stored in DB. Used to get new access tokens silently
- Frontend stores both in Zustand store (in-memory) — not localStorage (XSS protection)

### Token refresh
```
POST /api/v1/auth/refresh
Body: { refreshToken }
Returns: { accessToken }
```
Automatically called by the API client interceptor when a 401 is received.

### Logout
```
POST /api/v1/auth/logout
Body: { refreshToken }
```
Deletes the refresh token from DB. The JWT access token expires naturally at 15min.

### Password reset
```
POST /api/v1/auth/forgot-password    → sends email with reset link
POST /api/v1/auth/reset-password     → validates token, sets new password, kills all sessions
```

---

## SECTION 8 — SMTP Configuration (Email)

All transactional emails use Gmail SMTP via an App Password.

| Setting | Value |
|---------|-------|
| Provider | Gmail |
| App name | Vehicle Monitoring System |
| SMTP host | `smtp.gmail.com` |
| SMTP port | `587` |
| SMTP user | `byiringirofabrice6@gmail.com` |
| SMTP app password | `advlaszqtqwbybwc` |
| From address | `"ARTIC VMS" <noreply@articvms.ddnsgeek.com>` |

**Emails sent automatically:**
- Welcome email — on registration
- Password reset link — on forgot-password request
- Password changed confirmation — after successful reset
- Overdue payment reminder — to customers
- Document expiry warning — to org admins
- Vehicle offline alert — to fleet managers
- New registration alert — to Super Admin when a company registers
- Invitation email — when a user is invited to join a company

---

## SECTION 9 — Server Access Credentials

| Service | Access method | Details |
|---------|---------------|---------|
| Server SSH | `ssh articadmin@185.208.207.100` | Password auth (or key: `C:\Users\Byiringiro\.ssh\artic_vms`) |
| Root SSH | `ssh root@185.208.207.100` | Password auth |
| PostgreSQL | Via Docker only | `artic_user` / `[POSTGRES_PASSWORD from .env]` — not exposed to internet |
| Redis | Via Docker only | No password — bound to `127.0.0.1` only |
| GitHub repo | HTTPS | `https://github.com/Byiringiro24/Vehicle_Monitoring_system.git` |

**Project directory on server:** `/home/articadmin/artic-vms`
**Nginx config:** `/etc/nginx/sites-enabled/artic-vms`
**Docker containers:** `artic-vms-backend-1`, `artic-vms-frontend-1`, `artic-vms-postgres-1`, `artic-vms-redis-1`

---

## SECTION 10 — Quick Reference: Create a Test User

### Via seed (automatic — creates 3 demo users):
```bash
docker compose exec backend npm run seed
```

### Via API (programmatic):
```bash
curl -X POST https://articvms.ddnsgeek.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Test Company",
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "Test1234!",
    "country": "Rwanda"
  }'
```
This creates the company as **PENDING** — Super Admin must approve it first.

### Via dashboard (manual):
1. Log in as `admin@artic.io` / `Admin1234!`
2. Go to `/users` → + Add user
3. Fill in email, name, role, temporary password
4. Share credentials with the new user

---

## SECTION 11 — Password Policy & Security Notes

- **Minimum length:** 8 characters
- **Hashing:** bcryptjs, cost factor 12 (~300ms per hash — prevents brute force)
- **No plain text anywhere:** passwords never logged, never stored, never emailed
- **Reset token security:** SHA-256 hashed in DB, raw token only in email, expires in 30 minutes, single-use
- **Session security:** JWT (15min) + refresh token (7 days). All sessions killed on password change
- **Rate limiting:** Login endpoint limited to 20 requests per 15 minutes per IP. Register limited to 5 per hour
- **Force reset:** SUPER_ADMIN can reset any user's password from `/users` without knowing the old password
- **Account deactivation:** Setting `isActive = false` prevents login but preserves all data and history

---

*This document covers all credentials, account types, and authentication flows in ARTIC VMS.*
*Keep this file private — do not commit it to a public repository.*
