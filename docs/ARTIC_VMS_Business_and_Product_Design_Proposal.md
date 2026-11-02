# ARTIC VMS — Business and Product Design Proposal

## 1. Purpose

This document is a separate design proposal for ARTIC VMS, created as a business-ready and product-ready blueprint. It is intentionally kept separate from the operational technical and deployment docs so the project history and existing system documentation remain clean and protected.

---

## 2. Business Objective

ARTIC VMS is a complete operations platform for transport, fleet, logistics, and vehicle service businesses. It is designed to replace manual operations with a centralized platform that helps company owners, admin teams, drivers, riders, finance teams, support agents, and customers work from one system.

The business goal is to create a platform that is:

- trusted
- premium in presentation
- clear in workflow
- secure in access control
- scalable for real business use

---

## 3. Core Business Model

### Revenue streams
- company subscription plans
- per-user access
- per-vehicle fleet scaling
- premium add-on modules
- service provider bookings
- vehicle sales and listings
- owner payout and finance operations

### Primary customers
- vehicle fleet owners
- transport operators
- rental businesses
- vehicle resellers
- service providers
- drivers and riders
- individual customers

---

## 4. Roles and Access Structure

### Super Admin
- full platform oversight
- approval of company registrations
- plan and pricing management
- support oversight
- platform health and audit review

### Company Admin / Owner
- manages organization setup
- invites users
- assigns roles and access levels
- approves internal operational access
- controls company-level workflows

### Fleet / Ops Roles
- fleet manager
- dispatcher
- driver
- rider
- workshop technician

### Finance Roles
- accountant
- payroll and requisition approver
- owner statement reviewer

### Support and Compliance Roles
- support agent
- compliance officer
- auditor

### External Business Roles
- service provider
- vehicle seller
- customer

---

## 5. Role Access Principle

The system must follow a multi-role and multi-organization approach.

One user can have:
- multiple roles in the same organization
- different roles across different organizations
- personal portal access along with company responsibilities

The user should only see the pages and functions they are actually approved to use.

This is a major requirement because a finance person must not see dispatch operations unless approved, and a driver should not see all company financial data.

---

## 6. Privacy and Security Design

The technical architecture of the platform should remain hidden from general users. Only super admin and selected platform-level staff should see deep technical details such as:

- hardware architecture
- network design
- telemetry backend stack
- SIM, GPS, and device integration
- internal infrastructure and deployment model

This is a business security requirement and part of the operating model.

---

## 7. User Experience Standard

The system should feel premium and business-grade.

### Interface principles
- clean and premium dashboard layout
- clear role-specific landing pages
- consistent colors, cards, actions, and statuses
- strong hierarchy for urgent tasks
- minimal clutter

### Dashboard principle
Every user should see:
- what they need to do
- what is active
- what is pending
- what needs approval

No user should be forced to browse every page to complete their work.

---

## 8. Functional Modules

### Fleet operations
- vehicles
- drivers
- assignments
- tracking
- alerts
- maintenance

### Finance operations
- requisitions
- payroll
- owner payouts
- invoices
- statements
- approval queues

### Compliance and documents
- document upload
- review and approval
- expiry tracking
- validation tasks

### Support and ticketing
- customer support requests
- internal company support
- escalation routes
- reply tracking

### Sales and marketplace
- listings
- customer inquiries
- seller portal
- provider portal
- contract flow

---

## 9. Business Workflow Example

### Company onboarding
1. Company registers
2. owner creates organization
3. company status is pending review
4. super admin reviews and approves
5. organization gets active plan and access

### User onboarding
1. admin invites user
2. user accepts invitation
3. role is assigned and approved
4. user sees only their allowed dashboard

### Finance workflow
1. request is raised
2. approver reviews it
3. payment or payout is executed
4. financial records are stored and visible only to approved roles

---

## 10. Design Recommendation

ARTIC VMS should be treated as a full business operating system rather than a simple tracking tool.

The strongest product direction is:

- role-aware dashboards
- secure visibility rules
- clear approval workflows
- premium UI design
- business-ready personalization for each user type

This gives the platform a professional, real-world business feel while keeping it practical for operations.

---

## 11. Final Product Vision

The platform should make a business owner feel in control, a fleet manager feel informed, a finance officer feel secure, and a customer feel confident that the service is organized and trustworthy.

That is the true value of ARTIC VMS.
