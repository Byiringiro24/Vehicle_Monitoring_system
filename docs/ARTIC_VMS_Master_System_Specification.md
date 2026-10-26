# ARTIC VMS — Master System Specification
**Version:** 2.0 (October 2026)  
**Status:** Active development  
**Live system:** https://articvms.ddnsgeek.com

---

## 1. WHAT ARTIC VMS IS

ARTIC VMS is a configurable, multi-tenant fleet management, vehicle business, and transport marketplace platform. It serves companies that manage fleets, individual vehicle owners, drivers/riders, customers who need transport or rental services, and service providers.

**One platform. One identity. Many roles.**

A single person can simultaneously be:
- A Fleet Manager at Company A
- A vehicle owner whose motorcycle is managed by Company B
- A customer who rents from Company C
- A driver applying to Company D

They use one email address and one account. The platform shows them a different workspace for each role.

---

## 2. WHO USES THE PLATFORM

### 2.1 Platform Level

| Role | Description |
|---|---|
| SUPER_ADMIN | Owns and operates the ARTIC VMS platform. Approves companies, manages plans, configures support contacts, views all audit logs. |
| PLATFORM_SUPPORT | Handles support tickets. Limited view of company accounts (audited, time-bounded). |

### 2.2 Company Level (per organization)

| Role | Description |
|---|---|
| COMPANY_OWNER | Legal owner/founder. Final approval authority for payouts, role grants, ownership transfers. |
| COMPANY_ADMIN | Day-to-day administrator. Manages users, settings, invitations. |
| FLEET_MANAGER | Manages vehicles, drivers, GPS tracking, alerts, geofences, maintenance, documents. |
| DISPATCHER | Assigns drivers to trips. Sees live map and vehicle/driver availability. |
| FINANCE_MANAGER | Full financial access: invoices, payments, refunds, payouts, reports. |
| ACCOUNTANT | Records transactions, cannot approve or void. Submits for Finance Manager approval. |
| HR_MANAGER | Staff profiles, qualifications, attendance, shifts, leave, documents. |
| MECHANIC | Workshop work orders for their assigned jobs only. |
| COMPLIANCE_OFFICER | Document verification, licence/permit expiry, incidents, compliance flags. |
| RENTAL_MANAGER | Availability calendar, reservations, handovers, deposits, damage. |
| SALES_AGENT | Vehicle listings, inquiries, quotes, orders, installment plans. |
| AUDITOR | Read-only access to company records. All access logged. Time-limited. |

### 2.3 Personal Level (any user)

| Role | Description |
|---|---|
| CUSTOMER | Books transport, rents vehicles, views their own invoices and agreements. |
| VEHICLE_OWNER | Registers vehicles, requests management proposals, views income/expenses, manages ownership transfers. |
| DRIVER | Assigned vehicle with live telemetry, trips, earnings, documents. |
| RIDER | Motorcycle with daily/weekly remittance obligations, payment tracking. |

### 2.4 Provider Level

| Role | Description |
|---|---|
| SERVICE_PROVIDER | Workshop, GPS installer, maintenance — lists services, receives bookings. |
| VEHICLE_SELLER | Lists vehicles for sale with installment/trade-in options. |

---

## 3. HOW USERS GET ACCOUNTS

### New company
1. Visit `/register` → select "Register a company"
2. Complete 5-step wizard: company details, representative, locations, documents, review
3. Organization created as `PENDING`
4. User can log in → sees `/pending-approval` (not the dashboard)
5. Super Admin reviews and approves → org becomes `ACTIVE` → welcome email
6. User can now access the dashboard

### Staff member (invited)
1. ADMIN invites by email from `/users` → selects role
2. Invitee receives email with secure link
3. If they have an account: link connects to existing account (no duplicate)
4. If new: they set their password via the link
5. Role becomes active (immediately or after approval depending on role sensitivity)

### Individual (driver, owner, customer)
1. Visit `/register` → select "Create a personal account"
2. Email, name, password → account created
3. Personal dashboard shows onboarding checklist
4. Add roles: "I own a vehicle", "I want to be a driver", "I need transport services"

---

## 4. REGISTRATION AND APPROVAL STATES

Organizations move through these states:

```
DRAFT → SUBMITTED → PENDING_REVIEW → APPROVED (ACTIVE)
                                   → REJECTED (with reason)
                                   → MORE_INFORMATION_REQUIRED
ACTIVE → SUSPENDED → CLOSED
```

Role grants move through:
```
REQUESTED → PENDING_APPROVAL → ACTIVE → SUSPENDED → REVOKED → EXPIRED
```

---

## 5. SUBSCRIPTION PLANS

| Plan | Price | Seats | Key features |
|---|---|---|---|
| Free | $0/mo | 3 | GPS tracking, vehicles |
| Starter | $19/mo | 10 | + Drivers, alerts, basic reports |
| Business | $49/mo | 25 | + Finance, maintenance, documents, agreements |
| Enterprise | $99/mo | 100 | + AI assistant, double-entry accounting, custom roles |

Plans are version-controlled. Changing a plan version does not alter existing subscriptions.

---

## 6. SUPPORTED BUSINESS MODELS

The platform supports all of these without requiring code changes — configured by Company Admin:

| Model | Description |
|---|---|
| Daily/Weekly/Monthly Rental | Vehicle rented for a period. Configurable rates, deposits, mileage. |
| Hire-Purchase / Lease-to-Own | Customer pays installments and eventually owns the vehicle. |
| Vehicle Sale | Outright sale with optional installment plan. |
| Daily Rider Collection | Motorcycle owner collects daily/weekly remittance from rider. |
| Driver Supply / Chauffeur | Company supplies driver (with or without vehicle). |
| Passenger Transport | Routes, schedules, fares. |
| Cargo / Logistics | Freight jobs with proof of delivery. |
| Fleet Outsourcing | Manage customer-owned vehicles for a fee. |
| Vehicle Management | Owner gives vehicle to company; company handles drivers/collection/maintenance; owner gets net payout. |

---

## 7. WHAT IS BUILT (Current as of October 2026)

### Fully built and deployed:
- ✅ Authentication: login, register, forgot/reset password, JWT + refresh tokens
- ✅ Company registration with PENDING → approval flow
- ✅ Pending approval screen with feature preview and support contacts
- ✅ Rejection screen with reason
- ✅ Role-based access: 6 roles, sidebar filtering, page guards, role-appropriate dashboards
- ✅ Real-time GPS tracking: ESP32 → MQTT → Socket.IO → Leaflet map
- ✅ Vehicle management: 70+ field profiles, status tracking, GPS history, engine lock
- ✅ Driver management: 5-step wizard, license tracking, vehicle assignment
- ✅ Alerts: 17 types, 5 severities, acknowledge/resolve, real-time toasts
- ✅ Geofences: polygon/circle, entry/exit alerts, vehicle scoping
- ✅ Maintenance: service records, upcoming schedule, document expiry tracking
- ✅ Document management: upload, verification, expiry reminders, compliance dashboard
- ✅ Finance: P&L, contracts, expenses, driver payroll
- ✅ Agreements: configurable business models, payment schedule generation, overdue escalation
- ✅ Customers: CRM with credit scoring, agreement history
- ✅ Reports: fleet, vehicle profitability, driver payroll, financial statements, CSV export
- ✅ Support system: contact links (WhatsApp/phone/email/Instagram/TikTok), ticket submission, admin replies
- ✅ Platform admin: company management, pending approvals, subscription activation, audit logs
- ✅ Email: SMTP (Gmail), password reset, welcome, overdue reminders, document expiry
- ✅ Users: list, create, SUPER_ADMIN force reset, role-gated access
- ✅ Settings: org info, subscription details, alert rules, team members
- ✅ Memberships: multi-company membership tables, invitation system foundation

### Partially built:
- 🔶 Register page exists but newly includes pending approval flow (needs server rebuild to see)
- 🔶 Subscription entitlements exist in DB but feature-gating not wired to all pages
- 🔶 Document upload stores to `/uploads` on server (not cloud storage — risk in production)

### Not yet built:
- ❌ Public marketplace (service/vehicle directory visible without login)
- ❌ Vehicle owner portal (self-service owner with proposals, statements, payouts)
- ❌ Customer portal (bookings, quotes, agreements from customer side)
- ❌ Rider portal (motorcycle remittances)
- ❌ Service provider portal
- ❌ Vehicle seller portal
- ❌ Dispatcher board (drag-drop trip assignment)
- ❌ Workshop/mechanic work order queue
- ❌ HR staff management
- ❌ Compliance officer dashboard (beyond what's in documents page)
- ❌ Rental availability calendar
- ❌ Invitation-by-email with secure setup link (currently admin sets initial password)
- ❌ Workspace/context switcher (for multi-company users)
- ❌ Double-entry general ledger
- ❌ Invoice generation (PDF)
- ❌ Owner statements and payout approval workflow
- ❌ Cloud/S3 file storage (currently local filesystem)
- ❌ Mobile-optimized driver experience / PWA
- ❌ Approval workflows (payouts, role grants, refunds)
- ❌ Delegation / auditor grants
- ❌ AI assistant

---

## 8. BUILD ROADMAP

### Phase 1 — Fix and stabilize (current)
- ✅ Fix `const app = express()` build error
- ✅ Fix TypeScript error in DriverDashboard
- Fix SMTP env vars on server
- Rebuild and deploy frontend with all new pages

### Phase 2 — Complete the register + approval experience
- Self-serve registration with plan selection during signup
- Email notification to Super Admin on new registration
- Improved pending-approval screen with timeline

### Phase 3 — Personal and owner portals
- Vehicle owner portal (vehicles, proposals, statements, payouts)
- Customer portal (bookings, invoices, payments)
- Rider portal (remittances, agreement)

### Phase 4 — Staff roles and operational pages
- Dispatcher board
- Workshop/mechanic work queue
- HR staff management
- Compliance dashboard improvements

### Phase 5 — Finance improvements
- Invoice generation (PDF)
- Owner statements with payout approval workflow
- Proper double-entry accounting ledger

### Phase 6 — Marketplace
- Public service/vehicle directory
- Company public profiles
- Booking/quote request flow
- Provider portal

### Phase 7 — Multi-role identity
- Workspace/context switcher
- Invitation-by-email with secure setup link
- Delegation system
- Auditor grant system

### Phase 8 — Enterprise
- Cloud file storage (S3/R2)
- Mobile PWA for drivers
- AI assistant
- Webhook integrations
- Payment gateway (MTN MoMo, Airtel)

---

## 9. TECHNOLOGY STACK

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Frontend | Next.js 14, React 18, TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Real-time | Socket.IO |
| GPS messaging | MQTT (Aedes broker) |
| Cache | Redis |
| Auth | JWT + refresh tokens |
| Email | Nodemailer + Gmail SMTP |
| Maps | Leaflet + OpenStreetMap |
| Styling | Tailwind CSS |
| State | Zustand, React Query |
| Hosting | Contabo VPS, Docker Compose, Nginx |

---

## 10. NON-NEGOTIABLE SECURITY RULES

1. Every API endpoint checks role and scope — hiding a menu item is not security
2. Company A can never access Company B's data by changing a URL
3. Financial postings are transactional and audited — no silent edits
4. Ownership transfer requires conditions + authorization, not just payment completion
5. Engine lock requires typing the vehicle plate number to confirm
6. Document verification is separate from document upload
7. Super Admin access to company data is logged
8. Passwords are never emailed — only secure single-use reset links
9. All reset tokens are hashed in the database — raw token only ever in the email
10. Support contacts and social media are configured by Super Admin — never hardcoded
