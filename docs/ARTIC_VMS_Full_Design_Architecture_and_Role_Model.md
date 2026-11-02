# ARTIC VMS — Full System Design by Business Owner + Product Lead + Full-Stack Engineer + UI/UX Designer

## 1. Executive Summary

ARTIC VMS is a multi-tenant fleet and mobility operations platform designed for African transport and logistics businesses. It is built to serve the full lifecycle of an operation: vehicle acquisition, assigned use, driver management, maintenance, compliance, GPS tracking, smart alerts, rental contracts, customer bookings, finance management, and support operations.

The system is intentionally designed so that:

- Every organization has its own workspace and identity
- Users can hold more than one role within an organization or across organizations
- Each user sees only the pages, data, and actions that are relevant to them
- Sensitive operational data stays private and only visible to authorized roles
- Service and business portals are built for both company users and personal users
- The system is flexible enough to support companies, fleet operators, rental businesses, service providers, and marketplace users

---

## 2. Product Vision

The business goal is to create a platform that helps operators move from fragmented manual tracking into a single modern command center.

Core promises:

- Track every vehicle in real time
- Manage drivers, riders, and assignments
- Control services, maintenance, and compliance
- Process customer and rental contracts
- Monetize vehicle operations and service offerings
- Manage approvals, employees, and subscriptions
- Support platform-wide operations with a high-trust admin layer

This is not just a fleet dashboard. It is a full operating system for movement businesses.

---

## 3. Design Principles

### 3.1 Security First
- Private technical architecture is not exposed to regular users
- Platform support agents see only limited support context
- Finance, operational, and compliance data are separated by role access
- Company admins approve access and role changes
- Super Admin is the only role with platform-level control

### 3.2 Role Clarity
- One person may have many roles, but permissions are derived from their active organization and effective role set
- The user experience adapts to what the user is allowed to do, not just a generic dashboard
- A user who is a driver should see rider tools, while a finance manager sees finance tools

### 3.3 Simplicity for the User
- The interface should be premium, clear, and task-oriented
- Each portal focuses on one core job: fleet, finance, support, sales, maintenance, compliance, etc.
- Each page must present the user with the current objective, current status, and next action

### 3.4 Business Readiness
- The platform supports subscription plans, access tiers, and approval scenarios
- Company setup follows a verified onboarding flow
- Sensitive workflows need explicit approval before activation

---

## 4. Business Model

### 4.1 Revenue Model
The platform should make money in multiple ways:

1. Company subscriptions
   - Free, Starter, Business, Enterprise, Custom
2. Per-seat licensing
   - Additional admin or operator seats
3. Per-vehicle or fleet scaling
   - Based on number of tracked vehicles or operations
4. Premium add-ons
   - Dispatch, compliance automation, AI analytics, maintenance workflows, support escalation
5. Marketplace services
   - Provider listings, booking commissions, vehicle seller referral fees
6. Financial service modules
   - Requisition processing, payment handling, owner settlement dashboards

### 4.2 Business-to-Business Structure
- Company owner registers and configures the business
- Company admin manages users and roles
- Super Admin monitors platform operations and approval pipeline
- Support agent handles support queue and only limited user context

### 4.3 Customer Segments
- Fleet owners and logistics operators
- Mobility and transport companies
- Rental businesses
- Vehicle resellers and service providers
- Individual owners with personal vehicles
- Drivers and riders as operational users
- End customers seeking transport or service bookings

### 4.4 Market Strategy
- Start with commercial fleet operators in Rwanda and East Africa
- Offer a simple migration path from spreadsheets and WhatsApp management
- Provide a premium but practical interface to replace outdated manual ops
- Expand to vehicle resale, installation, maintenance networks, and rental businesses

---

## 5. Roles and Responsibilities

### 5.1 Super Admin
Role: platform owner and system authority

Responsibilities:
- Approve company registration and onboarding
- Manage plans and pricing
- Review support tickets and escalations
- Maintain platform-level health and audit
- Monitor uptime, DB, Redis, API, SMTP, MQTT
- View platform-wide user and subscription status

Permissions:
- Full platform oversight
- Company approval / rejection
- Plan assignment and feature enablement
- Support queue access
- Audit logs and system health

---

### 5.2 Company Owner / Admin
Role: business operator

Responsibilities:
- Setup and own the company workspace
- Invite users and assign roles
- Approve access and permissions
- Control operations, finance, compliance, fleet, and staff
- Manage business-level settings and onboarding

Permissions:
- Manage users and memberships
- Approve substitutes and role builds
- View operations, finance, telemetry, and reports
- Manage contracts, documents, and compliance

---

### 5.3 Fleet Manager
Role: operational lead

Responsibilities:
- Fleet allocation and assignment
- Vehicle health oversight
- Alerts and route operations
- Driver coordination
- Maintenance planning

Permissions:
- View all vehicles and dispatch operations
- Manage assigned drivers and alerts
- Review assigned maintenance and compliance status

---

### 5.4 Dispatcher
Role: task and movement coordinator

Responsibilities:
- Assign trips and tasks
- Coordinate schedule and operations
- Monitor live movement

Permissions:
- Dispatch view and route assignment tools
- Vehicle and driver assignment only within operational scope

---

### 5.5 Driver / Rider
Role: mobile field operator

Responsibilities:
- Complete assigned tasks
- Record remittance or daily payment obligations
- Track assigned vehicle status
- Maintain personal profile and required documents

Permissions:
- Personal driver/rider portal
- Assigned vehicle visibility
- Payment and agreement view
- Limited personal records only

---

### 5.6 Finance Manager / Accountant
Role: financial operator

Responsibilities:
- Manage payroll, requisitions, expenses, owner payouts
- Review active contracts, invoices, and payment status
- Approve or reject financial requests

Permissions:
- Finance dashboard and approval queue
- Payroll and payment operations
- Statements and reporting

---

### 5.7 HR Manager
Role: people operations

Responsibilities:
- Staff records and onboarding
- Attendance and staff status tracking
- License and qualification review coverage

Permissions:
- Staff portal and compliance tasks
- People records assigned to the organization

---

### 5.8 Mechanic / Technician
Role: maintenance specialist

Responsibilities:
- Maintain workshop jobs
- Update work orders and maintenance completion
- Record costs and service history

Permissions:
- Maintenance and workshop access
- Assigned vehicle maintenance records

---

### 5.9 Compliance Officer
Role: legal and document regulator

Responsibilities:
- Verify documents
- Monitor expiry windows
- Ensure operational compliance

Permissions:
- Documents and compliance review
- Expiry and review queue

---

### 5.10 Rental Manager
Role: rental operations lead

Responsibilities:
- Manage rental availability and bookings
- Handle rental contracts and pricing
- View rental performance

Permissions:
- Rentals, customers, agreements, and reports relevant to rental operations

---

### 5.11 Sales Agent
Role: vehicle sales and lead conversion

Responsibilities:
- Create and manage listings
- Manage inquiries and customer follow-up
- Track sales orders and leads
- Manage installations and conversion pipeline

Permissions:
- Vehicles / listings and sales dashboard
- Lead and inquiry management
- Sales performance overview

---

### 5.12 Customer / Passenger
Role: end user

Responsibilities:
- View personal agreements and bookings
- Track payment status and history
- Contact support if necessary

Permissions:
- Personal booking and agreement view
- Customer portal
- Limited own data only

---

### 5.13 Service Provider
Role: external service operator

Responsibilities:
- Create service listings
- Manage bookings
- Receive requests and confirm work
- Track payouts and provider profile

Permissions:
- Personal service provider portal
- Own services and bookings only

---

### 5.14 Vehicle Dealer / Seller
Role: marketplace seller

Responsibilities:
- List vehicles for sale
- Handle inquiries and price negotiations
- View sales and listing performance

Permissions:
- Seller portal
- Own listings and inquiry history

---

### 5.15 Auditor
Role: read-only reviewer

Responsibilities:
- Review operational records
- Validate actions and access audit trails
- Read-only investigation work

Permissions:
- Limited audit-view portal with time-bounded access
- Read-only access to assigned records

---

### 5.16 Platform Support Agent
Role: helpdesk and support operator

Responsibilities:
- Handle tickets and support communication
- Route issues to correct teams
- Provide limited company support context

Permissions:
- Support queue only
- Limited contextual company details
- No financial, operational, or raw private records unless explicitly granted

---

## 6. User Experience Model

### 6.1 Dashboard Philosophy
Every user sees a dashboard built around their responsibilities. The app does not show everything to everyone.

Examples:
- Driver portal: assignments, agreement, payment history, vehicle info
- Finance manager portal: requisitions, approvals, payroll, payouts
- Sales agent portal: listings, lead flow, sales pipeline
- Service provider portal: bookings, services, profile, payouts
- Super admin portal: platform health, approval screens, support, plans, audit

### 6.2 Personal Data Ownership
Every personal account should have editable personal fields:
- first name
- last name
- phone number
- password
- organization membership view
- account contexts

A user should be able to maintain their own data with minimal friction and should not be forced to request admin changes for basic information.

### 6.3 Editable Records
Document management should support:
- upload
- view
- replace
- reject / request correction
- expiry tracking
- review status
- delete with permission controls

This is critical for compliance and convenient operations.

---

## 7. System Architecture

### 7.1 Core Layers
- Frontend: Next.js app with role-sensitive navigation
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL via Prisma
- Real-time layer: Redis + MQTT for telemetry and device updates
- Authentication: JWT + refresh tokens
- File and document layer: secure document tracking with verification states
- Support and email layer: SMTP and support ticketing

### 7.2 Data Model Strategy
The platform uses:
- users
- organizations
- memberships
- roles and permissions
- vehicles
- drivers
- contracts
- agreements
- finance requests
- owner statements
- maintenance
- documents
- support tickets
- plans and subscriptions

### 7.3 Access Rules
Access decisions must be made using both:
- organization membership
- active role(s)
- approval state
- subscription status

The system should never rely on a single stale field like one generic role when users can hold multiple roles.

---

## 8. Business and Operational Workflow

### 8.1 Company Registration Flow
1. User registers company and personal account
2. Organization created
3. Company status is set to PENDING
4. Super Admin reviews application
5. Company is approved or rejected
6. Invoice and plan are activated if needed
7. Company owner can invite more users

### 8.2 User Invitation Flow
1. Admin invites user
2. User receives invitation and accepts
3. Membership and role are created
4. User sees relevant dashboard based on their granted role
5. Role can be changed or expanded as business needs evolve

### 8.3 Finance Workflow
1. Expense or request is raised as a requisition
2. Required approvers review it
3. Approval or rejection is recorded
4. Funds are scheduled or paid after policy review
5. Owner statements and payroll are produced

### 8.4 Compliance Workflow
1. Document uploaded
2. Status is set to PENDING_REVIEW or VERIFIED
3. Compliance officer verifies expiry, validity, and business purpose
4. Document may be rejected or accepted
5. Expiry notifications are generated before due dates

---

## 9. UI/UX Design Recommendations

### 9.1 Visual Direction
The interface should feel premium and trustworthy:
- clean white and slate surfaces
- blue and cyan brand accents
- subtle shadows and rounded cards
- premium business dashboard feel
- clear data hierarchy without clutter

### 9.2 Design Standards
- Every page should have: header, KPI cards, filters, list views, status badges, and a clear CTA
- Search should be accessible on all list-heavy pages
- Empty states and loading states should be designed thoughtfully
- Users should never be forced to navigate into hidden parts of the app to complete a task

### 9.3 Page-by-Page Principle
Each portal should answer three questions:
1. What is my job?
2. What do I need to see right now?
3. What action do I need to take next?

---

## 10. What This System Should Feel Like to the User

To a driver:
- I log in and see my assigned vehicle and payment obligation
- I can update my profile and documents that are relevant to me
- I do not see finance or company-wide operational data I should not access

To a fleet manager:
- I see vehicle health, assignment, alerts, and issues at a glance
- I can act on compliance and maintenance without extra manual delays

To a finance manager:
- I see requisitions, approvals, payroll, payouts, and finance performance
- I can track the financial state of the business clearly and quickly

To a support agent:
- I see support queue and limited customer context only
- I do not see private technical or operational data that may harm trust

To a business owner:
- I see all major operations in one place and can confirm the system is trustworthy
- I can grant role-based access and assign the right teams without chaos

---

## 11. Recommended Product Roadmap

### Phase 1 — Foundation
- user onboarding and approval
- organization and role model
- fleet, driver, and vehicle core modules
- documents and compliance

### Phase 2 — Operations
- dispatch and alerts
- maintenance and workshop
- rentals and customer booking flows
- support ticketing

### Phase 3 — Finance and Growth
- payroll and requisitions
- owner statements
- sales and service provider marketplace modules
- plan billing and subscriptions

### Phase 4 — Optimization
- advanced reporting
- audit automation
- AI-assisted operations and insights
- deeper mobile-first workflows

---

## 12. Final Strategic Conclusion

ARTIC VMS should be treated as a full operations platform, not just a vehicle tracking dashboard. The platform wins when it is built around real business operations, real user responsibilities, clear role segmentation, and polished user experience.

The most important design decision is this:

- The product must adapt to the user,
- not force every user to see everything.

That is what makes it professional, secure, scalable, and business-ready.

---

## 13. Recommended Next Implementation Priorities

1. Finish complete role-to-route enforcement for all user types
2. Make every editable personal information page consistent and complete
3. Ensure documents can be uploaded, replaced, reviewed, and rejected properly
4. Finalize sales, rentals, provider, owner, and support flows
5. Add audit log and support access restrictions as real policy enforcement
6. Prepare production-grade plan and billing policy such that the system feels operationally mature

---

This document reflects how the system should be designed from the viewpoint of a business owner, product strategist, full-stack engineer, UI developer, and end-user experience reviewer.
