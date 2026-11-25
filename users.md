# ARTIC VMS — User Credentials & Role Reference

> **System URL (local):** http://localhost:3000  
> **API URL (local):** http://localhost:4000  
> **System URL (production):** https://articvms.ddnsgeek.com  
> **All passwords:** `Admin1234!`

---

## 1. Platform — SUPER ADMIN Accounts

These accounts manage the entire platform. They create Company Admin accounts, approve organisations, control features, and manage plans.

| Name | Email | Phone | Password | Role |
|---|---|---|---|---|
| Super Admin (default) | admin@artic.io | — | Admin1234! | SUPER_ADMIN |
| Fabrice Byiringiro | fabricebyiringiro67@gmail.com | 0787585826 | Admin1234! | SUPER_ADMIN |

**Login options:**
- By email: `admin@artic.io` / `Admin1234!`
- By email: `fabricebyiringiro67@gmail.com` / `Admin1234!`
- By phone: `0787585826` / `Admin1234!`

**What SUPER_ADMIN can do:**
- Approve or reject company registrations
- Create Company Admin accounts
- Enable/disable features per company (Platform → Features tab)
- Manage subscription plans
- View all organisations and audit logs
- Access platform health dashboard

---

## 2. Testing Company — Admin Account

Organisation name: **Testing Company**  
Admin email: `byiringirofabrice6@gmail.com`

| Name | Email | Phone | Password | Role |
|---|---|---|---|---|
| Fabrice Admin | byiringirofabrice6@gmail.com | 0797585826 | Admin1234! | ADMIN |

**Login options:**
- By email: `byiringirofabrice6@gmail.com` / `Admin1234!`
- By phone: `0797585826` / `Admin1234!`

**What Company ADMIN can do:**
- Create all team member roles (Fleet Manager, Finance, HR, etc.)
- Edit and remove roles from existing users
- Enable/disable user accounts
- Manage organisation settings and logo
- Approve contracts submitted by Fleet Manager
- Access all features within their company
- View all reports, finance, vehicles, drivers

---

## 3. Testing Company — Team Members

All use password: `Admin1234!`

### Fleet & Operations

| Name | Email | Phone | Roles | Login by |
|---|---|---|---|---|
| Jean Uwimana | fleet@testing.artic | — | FLEET_MANAGER | Email |
| David Nkurunziza | david@testing.artic | 0788001001 | FLEET_MANAGER + COMPLIANCE_OFFICER | Email or Phone |
| Samuel Ndahimana | *(phone only)* | 0788001006 | FLEET_MANAGER + MECHANIC + DRIVER | Phone only |

**Fleet Manager can:**
- Register, edit, delete vehicles
- Register and manage drivers
- Assign vehicles to drivers
- Manage dispatch (trips)
- Manage geofences and alerts
- Record vehicle expenses
- Initialise driver contracts (submit for admin approval)
- Record daily vehicle payments and garage expenses
- Add and manage motorcycle drivers (Vehicle Report)
- Print AUTOEARN daily report

### Finance

| Name | Email | Phone | Roles | Login by |
|---|---|---|---|---|
| Marie Ingabire | finance@testing.artic | — | FINANCE_MANAGER | Email |
| Eric Bizimana | eric@testing.artic | 0788001005 | SALES_AGENT + FINANCE_MANAGER | Email or Phone |

**Finance Manager can:**
- Access full financial dashboard (P&L, cash flow, expenses)
- Record and manage vehicle expenses
- Manage invoices, payouts, approvals
- Record daily motorcycle driver payments
- Generate and download Excel/CSV reports
- Manage driver agreements and contracts
- Access vehicle report (daily collection, garage, fines)

### HR & Staff

| Name | Email | Phone | Roles | Login by |
|---|---|---|---|---|
| Grace Mukamana | grace@testing.artic | 0788001002 | HR_MANAGER + AUDITOR | Email or Phone |

**HR Manager can:**
- Manage staff attendance (check in/out)
- View driver qualifications and licence expiry
- Access compliance documents
- As AUDITOR: also read audit logs

### Workshop

| Name | Email | Phone | Roles | Login by |
|---|---|---|---|---|
| Patrick Habimana | *(phone only)* | 0788001003 | MECHANIC | Phone only |

**Mechanic can:**
- View and update workshop job records
- View vehicle maintenance schedules
- View documents and compliance records
- Access vehicle list (read)

### Rentals

| Name | Email | Phone | Roles | Login by |
|---|---|---|---|---|
| Agnes Uwase | *(phone only)* | 0788001004 | RENTAL_MANAGER | Phone only |

**Rental Manager can:**
- Manage rental calendar and reservations
- Create and manage vehicle handovers
- Manage rental agreements and customers
- Access vehicle list

### Audit (read-only)

| Name | Email | Phone | Roles | Login by |
|---|---|---|---|---|
| Ruth Mukarubibi | ruth@testing.artic | — | AUDITOR | Email |

**Auditor can:**
- Read-only access to audit logs
- View documents and compliance records
- View vehicles (read-only)
- Cannot create or edit anything

### Personal / Viewer

| Name | Email | Phone | Roles | Login by |
|---|---|---|---|---|
| Alice Kayitesi | alice@testing.artic | 0788001007 | VIEWER | Email or Phone |

**Viewer (personal account) can:**
- View their own vehicles (owner portal)
- View their own bookings and agreements
- Access their own profile

---

## 4. Testing Company — Drivers

All use password: `Admin1234!`

| Name | Email | Phone | License No | Classes | Expiry |
|---|---|---|---|---|---|
| Kalisa Mugabo | kalisa@testing.artic | 0789101001 | RW001001 | A, B | 2026-12-31 |
| Uwera Chantal | *(phone only)* | 0789101002 | RW001002 | B | 2027-06-30 |
| Ntwali Pacifique | ntwali@testing.artic | 0789101003 | RW001003 | A, B, C1 | 2025-09-15 ⚠ |
| Mukiza Christian | *(phone only)* | 0789101004 | RW001004 | B, D | 2027-03-20 |
| Ingrid Uwimana | ingrid@testing.artic | 0789101005 | RW001005 | B | 2026-08-10 |
| Remy Nshimiyimana | *(phone only)* | 0789101006 | RW001006 | A, B, C | 2028-01-01 |

**Driver can:**
- View their assigned vehicle and status
- Record daily remittance payment
- View their contract and payment history
- Access rider hub portal (`/rider`)

---

## 5. Testing Company — Vehicles

| Name | Plate | Make/Model | Class | Status |
|---|---|---|---|---|
| Toyota Land Cruiser | RAB 001 A | Toyota Land Cruiser | SUV | ACTIVE |
| Toyota Hiace Bus | RAB 002 B | Toyota Hiace | BUS | ACTIVE |
| Mitsubishi L200 | RAB 003 C | Mitsubishi L200 | PICKUP | AVAILABLE |
| Bajaj Boxer 150 | RAE 001 M | Bajaj Boxer 150 | MOTORCYCLE | ACTIVE |
| Honda CB 125 | RAE 002 M | Honda CB 125 | MOTORCYCLE | AVAILABLE |
| Isuzu NPR Truck | RAB 004 D | Isuzu NPR | TRUCK | MAINTENANCE |
| VW Passat Sedan | RAB 005 E | Volkswagen Passat | SEDAN | AVAILABLE |

---

## 6. Role Summary Table

| Role | Home Page | Key Permissions |
|---|---|---|
| **SUPER_ADMIN** | /platform | Full platform, approve orgs, features, plans |
| **PLATFORM_SUPPORT** | /platform/support | Support tickets only |
| **ADMIN** | /dashboard | Full company access, create/manage all users |
| **FLEET_MANAGER** | /dispatch | Vehicles, drivers, dispatch, vehicle report |
| **FINANCE_MANAGER** | /finance | Finance, invoices, payouts, vehicle report |
| **HR_MANAGER** | /staff | Staff, attendance, qualifications |
| **MECHANIC** | /workshop | Workshop jobs, maintenance view |
| **COMPLIANCE_OFFICER** | /compliance | Document verification, compliance |
| **RENTAL_MANAGER** | /rentals | Rental calendar, handovers, agreements |
| **SALES_AGENT** | /sales | Vehicle listings, customers, agreements |
| **AUDITOR** | /audit-view | Read-only audit logs, documents |
| **DRIVER** | /dashboard | Rider hub, own vehicle, remittances |
| **VIEWER** | /dashboard | Owner/customer portal, personal data |

---

## 7. Multi-Role Users

Users can hold multiple roles and **switch between them** after login:

1. After login → role picker screen (if 2+ roles)
2. Click any role card to enter that workspace
3. While working → click the role badge in the top bar → select a different role
4. The sidebar and dashboard update instantly to match the new role

---

## 8. Creating New Users

### As SUPER_ADMIN
- Go to `/users`
- Click **Create Company Admin**
- Fill name, email or phone, password
- Role is locked to **ADMIN** — SUPER_ADMIN cannot create any other role

### As Company ADMIN
- Go to `/users`
- Click **Add Member**
- Fill name, email and/or phone, password
- Select one or more roles from the list:
  - FLEET_MANAGER, FINANCE_MANAGER, HR_MANAGER, MECHANIC
  - COMPLIANCE_OFFICER, RENTAL_MANAGER, SALES_AGENT
  - AUDITOR, DRIVER, VIEWER
- Multiple roles = user can switch between them

### Edit / Remove roles
- Go to `/users` → click the pencil icon on any user
- Check/uncheck roles in the role picker
- Save — takes effect immediately on next login

### Enable / Disable users
- Go to `/users` → click the enable/disable toggle on any user row
- Disabled users cannot log in until re-enabled

---

## 9. Phone-Only Login

Users without an email can log in using their phone number:

1. On the login page, click **"Use phone instead"**
2. Enter phone number (e.g. `0788001003`)
3. Enter password → **Sign in**

Phone-only users can later add a verified email from `/profile` → Personal tab → **Link email address**.

---

## 10. How to Re-seed the Database

If you need to reset all demo users, vehicles and drivers:

```cmd
cd "d:\Projectts 2026\SANO IRENE\New folder (2)\backend"
node_modules\.bin\tsx src/utils/seed-demo.ts
```

This is idempotent — safe to run multiple times. It will update existing records rather than creating duplicates.

---

## 11. How to Start the System Locally

Open **two terminals**:

**Terminal 1 — Backend (port 4000):**
```cmd
cd "d:\Projectts 2026\SANO IRENE\New folder (2)\backend"
node_modules\.bin\tsx src/index.ts
```

**Terminal 2 — Frontend (port 3000):**
```cmd
cd "d:\Projectts 2026\SANO IRENE\New folder (2)\frontend"
node_modules\.bin\next dev --port 3000
```

Then open **http://localhost:3000** in your browser.

---

*Last updated: November 2026 · ARTIC VMS*
