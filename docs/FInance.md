# ARTIC VMS — Finance Manager: Complete Money Control System

Below is the full development spec that extends the existing Finance Manager role into a **single control point for every unit of money moving in, out, and within the company** — across all roles, all services, all contract types, and all ownership scenarios. It builds directly on the four domains (Part 1 of the Finance spec) and the existing role set in the Master Spec.

---

## PART A — THE PRINCIPLE

**The Finance Manager is the only role that can move money.** Every other role can *request*, *record draft*, or *prepare* money movement — but nothing leaves or enters the company's books without passing through the Finance Manager's approval queue.

```
  REQUESTER (any role)          FINANCE MANAGER              MONEY MOVES
  ─────────────────────         ─────────────────            ─────────────
  Driver      ──┐
  Rider       ──┤
  Mechanic    ──┤               ┌──────────────┐
  Dispatcher  ──┼── requisi. ──▶│ APPROVAL     │──▶ Payment / Payout
  Fleet Mgr   ──┤   form        │ QUEUE        │──▶ Expense posted
  HR Mgr      ──┤               │              │──▶ Owner statement
  Rental Mgr  ──┤               │ (approve /   │──▶ Refund
  Sales Agent ──┤               │  reject /    │──▶ Salary
  Customer    ──┤               │  hold)       │──▶ Petty cash
  Owner       ──┘               └──────────────┘
                                       ▲
                              Separation of duties:
                              creator ≠ approver
```

**Core rule:** *No money movement without a source record. No source record without an approval. No approval by the person who created it.*

---

## PART B — THE MASTER MONEY TAXONOMY

Every financial event in ARTIC VMS belongs to exactly one of **eleven money flows**. The Finance Manager controls all of them.

| # | Flow | Direction | Typical source | Who requests | Who approves |
|---|------|-----------|----------------|--------------|--------------|
| 1 | Customer payment in | IN | Invoice / agreement / booking | Customer, Sales, Rental Mgr | Auto (reconciled) or FM |
| 2 | Refund to customer | OUT | Refund request on payment | Customer, Rental Mgr, Sales | FM (+ Owner if > threshold) |
| 3 | Deposit / hold | IN then OUT | Rental handover | Rental Mgr | FM |
| 4 | Driver / rider pay | OUT | Contract + trips + attendance | Driver, Dispatcher, HR | FM (+ Owner) |
| 5 | Salary / payroll | OUT | Employment contract | HR Mgr | FM → Owner executes |
| 6 | Expense (operating) | OUT | Purchase / work order / receipt | Any staff | FM |
| 7 | Requisition (advance) | OUT | Requisition form | Any staff | FM |
| 8 | Owner payout | OUT | Owner statement | System generates; FM reviews | FM → Owner executes |
| 9 | Supplier / subcontractor | OUT | Purchase order / invoice | Fleet Mgr, Mechanic | FM |
| 10 | Platform subscription | OUT | Platform invoice | System | FM or Company Owner |
| 11 | Internal transfer | INTERNAL | Treasury move | FM only | FM (single) |

**Every flow maps to a table, a state machine, a permission set, and an audit entry.**

---

## PART C — THE REQUISITION SYSTEM (the heart of "each user may require")

This is the universal request object. **Every** non-automatic money-out starts as a **Requisition**. It is the only way a driver, mechanic, dispatcher, HR manager, fleet manager, rental manager, sales agent, customer, or owner can ask the company to spend money.

### C.1 Requisition types

| Type | Raised by | Purpose | Example |
|------|-----------|---------|---------|
| `EXPENSE_REIMBURSEMENT` | Any staff | "I paid, reimburse me" | Mechanic bought brake pads |
| `PURCHASE_ADVANCE` | Fleet Mgr, Mechanic | "Give me money to buy" | Fuel advance for trip |
| `DRIVER_ADVANCE` | Driver | Salary/commission advance | "Advance RWF 50k on my pay" |
| `PER_DIEM` | Driver, Dispatcher | Trip per-diem | Overnight trip allowance |
| `FUEL_ADVANCE` | Driver | Fuel money for trip | RWF 30k diesel |
| `PETTY_CASH` | Any staff | Small cash spend | Office supplies |
| `SALARY_ADJUSTMENT` | HR Mgr | Bonus / deduction | Safety bonus |
| `DRIVER_DEDUCTION` | Fleet Mgr, FM | Fine / damage recovery | Damage on RAB 123 A |
| `OWNER_PAYOUT` | System (from statement) | Pay vehicle owner | Net from owner statement |
| `SUPPLIER_PAYMENT` | Fleet Mgr, Mechanic | Pay garage / supplier | Workshop invoice |
| `REFUND` | Rental Mgr, Sales | Refund customer | Deposit return |
| `SUBCONTRACTOR_PAY` | Dispatcher, Fleet Mgr | Pay outside driver/vehicle | Hired trip |
| `CUSTOM` | FM only | Anything else | — |

### C.2 Requisition form (universal)

```
┌─────────────────────────────────────────────────────────────┐
│ New requisition                                             │
├─────────────────────────────────────────────────────────────┤
│ Type:          [Fuel advance ▾]                             │
│ Requested by:  Jean M. (Driver)  — auto-filled              │
│ Amount:        [30,000] RWF                                 │
│ Needed by:     [31 Oct 2026]                                │
│ Reason:        [Diesel for trip TRP-1042 Kigali→Musanze]    │
│                                                             │
│ LINK TO REAL RECORDS (required where applicable)            │
│ Vehicle:       [RAB 123 A ▾]                                │
│ Trip:          [TRP-1042 ▾]                                 │
│ Work order:    [—]                                          │
│ Agreement:     [—]                                          │
│                                                             │
│ ATTACHMENTS                                                 │
│ [Receipt photo] [Quote] [Other]                             │
│                                                             │
│ PAYMENT PREFERENCE                                          │
│ ◉ Mobile money (my registered number)                       │
│ ○ Bank transfer   ○ Cash                                    │
│                                                             │
│ COST ALLOCATION (finance use)                               │
│ ◉ Charge to vehicle RAB 123 A                               │
│ ○ Charge to trip TRP-1042                                   │
│ ○ Charge to company overhead                                │
│                                                             │
│ [Submit requisition]  [Save draft]  [Cancel]                │
└─────────────────────────────────────────────────────────────┘
```

**Validation the system enforces on submit:**
- Amount > 0 and ≤ role-based cap (e.g., a driver cannot request more than RWF 100,000 without FM pre-approval)
- Linked record must belong to the requester's company and be relevant (a driver cannot link a trip they didn't drive)
- If type = `EXPENSE_REIMBURSEMENT`, a receipt attachment is required
- If type = `DRIVER_ADVANCE`, the driver must have an active employment contract and available balance (advance ≤ X% of expected monthly pay)
- Duplicate detection: same amount + same type + same day → warn

### C.3 Requisition state machine

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → SCHEDULED → PAID → RECONCILED
                 ↘ ON_HOLD ↗
                 ↘ REJECTED (with reason)
                 ↘ CANCELLED (by requester, only while SUBMITTED)
APPROVED → PARTIALLY_PAID → PAID
PAID → RECONCILED (when payment matches provider settlement)
Any → VOID (FM only, before PAID, audited)
```

### C.4 Finance Manager approval queue `/finance/requisitions`

```
┌─────────────────────────────────────────────────────────────┐
│ Requisitions                    [Bulk approve]  [Export]    │
│ Tabs: [Pending 12] [On hold 2] [Approved 34] [All]          │
│ Filter: [Type ▾] [Requester ▾] [Amount ▾] [Date ▾]          │
├─────────────────────────────────────────────────────────────┤
│ #      │ Type           │ Requester │ Amount │ Linked  │ Age │
├────────┼────────────────┼───────────┼────────┼─────────┼─────┤
│ REQ-08 │ Fuel advance   │ Jean M.   │ 30,000 │TRP-1042 │ 2h  │
│ REQ-07 │ Reimbursement  │ Eric K.   │ 45,000 │WO-231   │ 5h  │
│ REQ-06 │ Driver advance │ Marie U.  │ 50,000 │EMP-044  │ 1d  │
│ REQ-05 │ Petty cash     │ Sarah (Acct)│ 8,000│—        │ 1d  │
│ REQ-04 │ Refund         │ Rental Mgr│120,000 │AGR-612  │ 2d  │
├─────────────────────────────────────────────────────────────┤
│ Selected 0 · Total pending RWF 253,000                      │
└─────────────────────────────────────────────────────────────┘
```

Clicking a row opens the **decision drawer**:

```
┌─────────────────────────────────────────────────────────────┐
│ REQ-08 · Fuel advance · Jean M.            ● Submitted      │
├─────────────────────────────────────────────────────────────┤
│ Amount: RWF 30,000 · Needed: 31 Oct · Age: 2h               │
│ Vehicle: RAB 123 A · Trip: TRP-1042 (Kigali→Musanze)        │
│ Driver available advance: RWF 65,000 of 200,000 cap         │
│                                                             │
│ CHECKLIST (auto-evaluated)                                  │
│ ✅ Requester active · ✅ Trip belongs to driver             │
│ ✅ Vehicle active · ✅ Within advance cap                   │
│ ⚠️ Fuel advance already issued this week (REQ-06)           │
│                                                             │
│ DECISION                                                    │
│ ○ Approve full   ○ Approve partial [RWF ____]               │
│ ○ Hold (reason)  ○ Reject (reason required)                 │
│ Notes to requester: [________]                              │
│                                                             │
│ [Approve] [Hold] [Reject] [Open trip] [Open vehicle]        │
└─────────────────────────────────────────────────────────────┘
```

On **Approve**, the system creates a `Payment` record in state `SCHEDULED` and, depending on type, immediately links it to a payout batch or to the next payroll run.

### C.5 Approval thresholds & two-person rule

| Amount (RWF) | Approver required |
|---|---|
| ≤ 20,000 | Finance Manager alone |
| 20,001 – 100,000 | Finance Manager |
| 100,001 – 500,000 | Finance Manager + Company Owner |
| > 500,000 | Finance Manager + Company Owner + second Admin |

- **Creator can never approve** their own requisition (enforced at DB level, not UI).
- **Owner payout and salary execution** always require a second approver regardless of amount.
- **Auditor** sees the full queue read-only with all decisions and timestamps.

---

## PART D — USER-LEVEL MONEY CONTROL (every role, every scenario)

This is the field-by-field map of what each user type can owe, be owed, request, and receive.

### D.1 Driver money scenarios

A driver's finances are computed from **five components**:

```
DRIVER NET PAY
= base_salary (if SALARY or HYBRID contract)
+ trip_commission (if COMMISSION or PER_TRIP)
+ percentage_commission (% of trip revenue, if configured)
+ bonuses (safety, punctuality, manual with approval)
− deductions (fuel advance recovered, fines, damage, salary advance)
− statutory (PAYE, RSSB — if payroll module enabled)
```

**Every component has a source record:**

| Component | Source table | Controlled by |
|---|---|---|
| Base salary | `employment_contracts.base_salary` | HR_MANAGER prepares, FM executes |
| Trip commission | `trips` linked to driver × `contract.commission_rate` | System computes |
| Percentage commission | `trips.revenue × contract.pct` | System computes |
| Bonus | `salary_adjustments` (type=BONUS) | HR/Fleet requests, FM approves |
| Deduction | `salary_adjustments` (type=DEDUCTION) | Fleet/FM requests, FM approves |
| Advance recovery | `requisitions` (type=DRIVER_ADVANCE, status=PAID) | FM deducts at payroll |
| Per-diem | `requisitions` (type=PER_DIEM) | FM approves per trip policy |
| Fuel advance | `requisitions` (type=FUEL_ADVANCE) | FM approves, recovered from pay or reconciled with receipts |

**Driver contract types the Finance Manager must handle (all configurable):**

| Contract | Driver gets | Company keeps | Example |
|---|---|---|---|
| `FIXED_SALARY` | Monthly salary | All trip revenue | Employee driver |
| `COMMISSION_PCT` | X% of trip revenue | (100−X)% | 15% commission |
| `PER_TRIP` | Fixed amount per completed trip | Rest | RWF 8,000/trip |
| `HYBRID` | Base salary + commission | Rest | 100k + 10% |
| `PER_DAY` | Daily rate × attendance days | Rest | RWF 12,000/day |
| `RIDER_REMITTANCE` | Keeps remainder of daily collections | Fixed daily remittance | Rider owes 20k/day |
| `OWNER_DRIVER` | Owns the vehicle, keeps net after company fee | Management fee | Vehicle owner driving own car |

**Rider remittance scenario (motorcycle):**
```
Daily collection (fares)            RWF 35,000
− agreed daily remittance to company RWF 20,000
= rider keeps                        RWF 15,000
If collection < remittance → shortfall carried as rider debt (with approval)
```
- Rider records daily collection in the app.
- System computes remittance due.
- Finance Manager sees a **Rider Remittance Ledger** showing paid/short/over per rider per day.
- Shortfalls become `salary_adjustments` deductions or `requisitions` for recovery.

**Driver payment detail with all components** (extends §2.6 of the Finance spec):
```
Driver payment · Jean M. · Oct 2026            ● Pending
Contract: EMP-091 · COMMISSION_PCT 15%
─────────────────────────────────────────────────────────
EARNINGS
  Base salary (n/a for this contract)           RWF      0
  Trip commission: 42 trips × rev 800,000 ×15%  RWF 120,000
  Safety bonus                                  RWF  15,000
  Per-diem (3 overnight trips)                  RWF  18,000
                                     Subtotal   RWF 153,000
DEDUCTIONS
  Fuel advance recovered (REQ-08)               RWF  30,000
  Salary advance recovered (REQ-06)             RWF  50,000
  Damage RAB 123 A (approved)                   RWF   5,000
                                     Subtotal   RWF  85,000
─────────────────────────────────────────────────────────
NET PAYABLE                                     RWF  68,000
Payout method: Mobile money
[Approve] [Request changes] [Reject] [Download PDF]
```

### D.2 Rider money scenarios

Covered above under `RIDER_REMITTANCE`. The Finance Manager sees:
- Daily remittance due vs paid per rider
- Cumulative shortfall / overpayment
- Motorcycle deposit and handover condition charges
- Damage recovery (from handover inspection)

### D.3 Mechanic money scenarios

| Scenario | Flow | Control |
|---|---|---|
| Buys parts for a job | Requisition `PURCHASE_ADVANCE` or `EXPENSE_REIMBURSEMENT` | Links to work order; receipt required |
| Outside supplier invoice | `SUPPLIER_PAYMENT` requisition | Links to work order + supplier invoice |
| Job completion bonus | `SALARY_ADJUSTMENT` (bonus) | HR/FM approves |
| Damage caused by mechanic | `DRIVER_DEDUCTION` (reuse for staff) | FM approves with evidence |

Mechanic **never** pays a supplier directly without FM approval. If they must (emergency), they raise a reimbursement with the receipt the same day.

### D.4 Fleet Manager money scenarios

| Scenario | Flow |
|---|---|
| Fuel for a trip | `FUEL_ADVANCE` requisition |
| Road tax / insurance / inspection | `EXPENSE` (expense module) — FM approves |
| Subcontractor hire | `SUBCONTRACTOR_PAY` requisition |
| Tolls / parking / washing | `EXPENSE` (petty) |
| Vehicle purchase | High-value requisition (Owner + Admin + FM) |

Fleet Manager **cannot** approve expenses — only request. This is a core separation-of-duties rule.

### D.5 Rental Manager money scenarios

| Scenario | Flow |
|---|---|
| Customer pays rental | Payment in (auto-reconciled) |
| Deposit collected | Deposit hold (liability, not revenue) |
| Deposit refund | `REFUND` requisition → FM approves |
| Damage charge | Invoice to customer + deposit offset |
| Late fee | Invoice line on final invoice |
| Handover fuel difference | Charge at handover rate |

**Deposit accounting (critical):** A deposit is a **liability**, not revenue. It sits in `deposits` table:
```
Deposit received  → liability +X
Deposit refunded  → liability −X, cash −X
Deposit forfeited → liability −X, revenue +X (with FM + Owner approval)
Damage offset     → liability −X, revenue/inventory +X
```
The Finance Manager's balance sheet must show deposits held as a liability line.

### D.6 Sales Agent money scenarios

| Scenario | Flow |
|---|---|
| Vehicle sale (outright) | Customer payment in → invoice |
| Installment sale | Payment schedule → each installment is a payment |
| Trade-in | Asset swap + valuation record |
| Commission to sales agent | `SALARY_ADJUSTMENT` (commission) — FM approves |

Installment schedules are generated at agreement creation and every installment is a real `scheduled_payments` row that the Finance Manager tracks for aging and overdue.

### D.7 HR Manager money scenarios

HR prepares, Finance executes. HR can:
- Propose salary changes (`salary_adjustment` type=SALARY_CHANGE)
- Propose bonuses / deductions
- Record attendance that feeds per-day pay
- Propose leave without pay (affects pay)

HR **cannot** approve its own proposals. FM approves; Owner executes salary runs.

### D.8 Customer money scenarios

| Scenario | Flow |
|---|---|
| Pays invoice | Payment in |
| Requests refund | `REFUND` requisition → FM |
| Books rental (deposit) | Deposit hold |
| Overdue balance | Aging → reminders → escalation |
| Disputes a charge | Dispute ticket → FM resolves with credit note |

Customers can **see** their own invoices, payments, deposits, and statements but **cannot** move company money except by paying.

### D.9 Vehicle Owner money scenarios (the ownership matrix)

This is the most complex domain. The Finance Manager must handle **every ownership/agreement combination**. The system models it as two independent axes:

**Axis 1 — Who owns the vehicle now?**
`COMPANY` · `OWNER` · `CUSTOMER (hire-purchase in progress)` · `THIRD_PARTY`

**Axis 2 — What is the management agreement?**
`MANAGEMENT_FEE_FIXED` · `MANAGEMENT_FEE_PCT` · `LEASE_TO_COMPANY` · `HIRE_PURCHASE` · `OWNER_SELF_DRIVE` · `PROFIT_SHARE`

The Finance Manager's payout logic for each combination:

| # | Ownership | Agreement | Money in | Deductions | Payout to owner | Ownership after |
|---|---|---|---|---|---|---|
| 1 | Owner | Management, fixed fee | All trip/rental revenue | Fixed fee + owner-responsibility costs | Gross − fee − costs | Owner keeps |
| 2 | Owner | Management, % fee | All revenue | % fee + owner-responsibility costs | Gross − fee − costs | Owner keeps |
| 3 | Owner | Lease to company | Company keeps all revenue | Lease payment to owner | Fixed lease amount | Owner keeps; company operates |
| 4 | Owner | Hire-purchase (customer buying) | Customer installments | Company margin | — (owner already sold) | Customer on final payment |
| 5 | Owner | Profit share | All revenue | Costs, then split | Agreed % of net | Owner keeps |
| 6 | Company | Company-operated | All revenue | All costs | — (company profit) | Company |
| 7 | Company | Sold hire-purchase to customer | Customer installments | Company cost basis | — | Customer on completion |
| 8 | Owner self-drive | Owner drives own vehicle, pays company | Owner pays company fee/remittance | — | — | Owner keeps |
| 9 | Third party | Subcontract | Job revenue | Subcontractor pay | Pay subcontractor | Third party keeps |

**The system stores this as:**

```
vehicle_ownership
  ├─ current_owner_type       (COMPANY | OWNER | CUSTOMER | THIRD_PARTY)
  ├─ current_owner_id         (org / user / customer)
  ├─ ownership_history[]      (who owned when, transfer events)
  └─ transfer_conditions      (for hire-purchase: installments paid, final payment, transfer fee)

management_agreements
  ├─ agreement_type
  ├─ fee_type / fee_value
  ├─ responsibility_matrix    (who pays fuel, maintenance, insurance, tyres…)
  ├─ payout_frequency         (monthly / per-trip / on-demand)
  ├─ payout_method
  └─ effective_from / to

owner_statements (generated per period)
  ├─ revenue_lines[]          (each linked to trip/rental/sale)
  ├─ deduction_lines[]        (each linked to expense/work order/fee)
  ├─ net_payable
  ├─ status                   (DRAFT → PENDING_APPROVAL → APPROVED → PAID)
  └─ payout_payment_id
```

**Ownership transfer scenarios the Finance Manager must execute:**

1. **Hire-purchase completion** — customer pays final installment → system checks all conditions (installments paid, transfer fee, documents) → FM approves transfer → ownership record updated → owner statement closed → transfer certificate generated (PDF, branded).
2. **Owner sells to company** — valuation record + purchase requisition → FM + Owner approve → payment to owner → ownership → COMPANY.
3. **Company sells to customer** — sale invoice + deposit → payment schedule → ownership transfer on completion.
4. **Owner withdraws vehicle** — final statement, outstanding costs settled, handover inspection, ownership remains OWNER but vehicle removed from fleet.
5. **Death/inheritance/legal transfer** — special approval path, requires Owner + Admin + FM, full audit.

**Owner statement detail (expanded from Finance spec §2.5) showing every line:**
```
Owner statement · Alex K. · Oct 2026           ● Pending
Vehicle: RAB 123 A · Agreement AGR-612 (MANAGEMENT_FEE_PCT 20%)
Responsibility: owner pays maintenance; company pays fuel
─────────────────────────────────────────────────────────
REVENUE (linked records)
  Trip revenue — 42 trips                    RWF 380,000
  Rental revenue — 5 days                    RWF  70,000
  Other (tolls recovered)                    RWF   0
                                    Gross    RWF 450,000
DEDUCTIONS
  Management fee (20% of gross)              RWF  90,000
  Maintenance — WO-231 brake pads            RWF  45,000
  Maintenance — WO-240 service               RWF  30,000
  Insurance (owner responsibility)           RWF  12,000
  Fuel (company responsibility → RWF 0)      RWF       0
                                    Total    RWF 177,000
─────────────────────────────────────────────────────────
NET PAYABLE                                  RWF 273,000
Payout: Mobile money · due 5 Nov 2026
[Approve] [Request changes] [Reject] [Download PDF] [Excel]
```

Notice: the responsibility matrix decides **who bears each cost**. The Finance Manager sees the matrix inline and can override a line only with a written reason (audited).

### D.10 Subcontractor / third-party scenarios

- Dispatcher hires an outside vehicle/driver for a job → `SUBCONTRACTOR_PAY` requisition → links to the job/trip → FM approves → payment → cost allocated to that trip's P&L.

### D.11 Company Owner & Admin scenarios

- Owner and Admin can approve high-value items but **cannot execute payments** without FM (separation).
- Platform subscription payments: FM or Owner can pay.
- Owner draw / dividend: special requisition type `OWNER_DRAW` — requires Admin second approval and appears in equity, not expenses.

---

## PART E — COMPLETE FINANCE MANAGER PAGES (new & extended)

The existing Finance pages (Invoices, Payments, Expenses, Owner Statements, Driver Payments, Platform Billing, Reconciliation, Reports) are extended with these **new pages**:

### E.1 `/finance/requisitions` — Approval queue (defined in Part C.4)

### E.2 `/finance/payroll` — Payroll runs

```
┌─────────────────────────────────────────────────────────────┐
│ Payroll · October 2026          [+ New run]  [Export]       │
├─────────────────────────────────────────────────────────────┤
│ Run      │ Period     │ Staff │ Gross    │ Deduct  │ Net    │ Status │
├──────────┼────────────┼───────┼──────────┼─────────┼────────┼────────┤
│ PR-2026-10│ Oct 2026  │ 18    │ 4,200,000│ 620,000 │3,580,000│ Draft │
│ PR-2026-09│ Sep 2026  │ 18    │ 4,100,000│ 580,000 │3,520,000│ Paid  │
└─────────────────────────────────────────────────────────────┘
```
- Run pulls every staff member with an active contract (drivers, riders, admins, mechanics, HR…).
- Each line = base + commissions + bonuses − deductions − advances recovered − statutory.
- FM reviews line by line → approve → Owner executes → payments created per staff payout method.
- Payslip PDF per employee (branded).

### E.3 `/finance/deposits` — Deposits held (liability register)

```
Customer    │ Agreement │ Deposit  │ Held since │ Status   │ Action
Kigali Sch. │ AGR-612   │ 200,000  │ 1 Oct 26   │ Held     │ [Refund]
Express R.  │ AGR-620   │ 150,000  │ 15 Oct 26  │ Held     │ [Refund]
SafeMove    │ AGR-618   │ 100,000  │ 20 Sep 26  │ Forfeited│ [View]
```
Every refund is a requisition; forfeiture needs FM + Owner.

### E.4 `/finance/ownership` — Ownership & transfer register

```
Vehicle   │ Current owner     │ Agreement        │ Next event
RAB 123 A │ Alex K. (OWNER)   │ Management 20%   │ Statement 5 Nov
RAC 456 B │ Marie U. (OWNER)  │ Lease to co.     │ Lease 1 Nov
RAB 789 C │ Jean M. (CUSTOMER)│ Hire-purchase    │ Installment 7/12
RAD 012 D │ Company           │ —                │ —
```
Clicking opens ownership history, transfer conditions, and transfer actions.

### E.5 `/finance/transfers` — Internal treasury transfers

Move money between bank / mobile money / petty cash. FM only. Each transfer creates two ledger legs.

### E.6 `/finance/approvals` — Unified approval inbox

One inbox for **everything** awaiting the Finance Manager: requisitions, expenses, owner statements, driver payouts, payroll runs, refunds, high-value payments. This is the FM's daily home base — replaces hunting across tabs.

### E.7 Extended `/finance/reports`

Add to existing reports:
- **Requisition register** (all requests, decisions, aging)
- **Payroll summary by role**
- **Deposit liability report**
- **Ownership & transfer report**
- **Owner payout history**
- **Rider remittance ledger**
- **Driver advances & recoveries**
- **Cost allocation by vehicle / trip / overhead**
- **Cash position by account**
- **Approval audit trail** (who approved what, when, from which device)

All follow the same PDF/Excel pipeline with automatic branding (Part 3 of the Finance spec).

---

## PART F — DATABASE SCHEMA (new tables)

```prisma
model Requisition {
  id            String   @id @default(uuid())
  orgId         String
  number        String   // REQ-0001, sequential per org
  type          RequisitionType
  requesterId   String
  amount        Decimal
  currency      String   @default("RWF")
  neededBy      DateTime?
  reason        String
  status        RequisitionStatus @default(DRAFT)

  // real-record links (all optional, validated by type)
  vehicleId     String?
  tripId        String?
  workOrderId   String?
  agreementId   String?
  contractId    String?
  customerId    String?
  ownerId       String?

  attachments   Json?    // [{type, url, sha256}]
  paymentMethod String?
  costCenter    CostCenter?

  approvals     Approval[]
  payments      Payment[]
  history       RequisitionEvent[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum RequisitionType {
  EXPENSE_REIMBURSEMENT PURCHASE_ADVANCE DRIVER_ADVANCE PER_DIEM
  FUEL_ADVANCE PETTY_CASH SALARY_ADJUSTMENT DRIVER_DEDUCTION
  OWNER_PAYOUT SUPPLIER_PAYMENT REFUND SUBCONTRACTOR_PAY OWNER_DRAW CUSTOM
}

enum RequisitionStatus {
  DRAFT SUBMITTED UNDER_REVIEW ON_HOLD APPROVED SCHEDULED
  PARTIALLY_PAID PAID RECONCILED REJECTED CANCELLED VOID
}

model Approval {
  id             String   @id @default(uuid())
  requisitionId  String?
  entityType     String   // requisition | expense | statement | payroll | refund
  entityId       String
  approverId     String
  decision       ApprovalDecision  // APPROVE | REJECT | HOLD | PARTIAL
  approvedAmount Decimal?
  reason         String?
  createdAt      DateTime @default(now())
  deviceInfo     Json?
}

model Deposit {
  id            String   @id @default(uuid())
  orgId         String
  agreementId   String
  customerId    String
  amount        Decimal
  status        DepositStatus  // HELD | REFUNDED | FORFEITED | OFFSET
  receivedAt    DateTime
  resolvedAt    DateTime?
  refundReqId   String?
  forfeitureApproval Json?
}

model VehicleOwnership {
  id               String   @id @default(uuid())
  vehicleId        String
  ownerType        OwnerType      // COMPANY | OWNER | CUSTOMER | THIRD_PARTY
  ownerUserId      String?
  ownerCustomerId  String?
  ownerOrgId       String?
  effectiveFrom    DateTime
  effectiveTo      DateTime?
  transferConditions Json?       // hire-purchase conditions
  agreementId      String?
}

model ManagementAgreement {
  id                 String   @id @default(uuid())
  vehicleId          String
  ownerId            String
  type               MgmtType  // FEE_FIXED FEE_PCT LEASE PROFIT_SHARE SELF_DRIVE
  feeType            String?
  feeValue           Decimal?
  responsibility     Json     // {fuel:"COMPANY", maintenance:"OWNER", ...}
  payoutFrequency    String
  payoutMethod       String
  effectiveFrom      DateTime
  effectiveTo        DateTime?
}

model SalaryAdjustment {
  id           String   @id @default(uuid())
  contractId   String
  type         AdjustType  // BONUS DEDUCTION SALARY_CHANGE COMMISSION LEAVE_UNPAID
  amount       Decimal
  reason       String
  requisitionId String?
  approvedById String?
  effectiveDate DateTime
}

model RiderRemittance {
  id           String   @id @default(uuid())
  riderId      String
  date         DateTime
  collected    Decimal
  due          Decimal
  paid         Decimal
  shortfall    Decimal
  status       String
  paymentId    String?
}

model PayrollRun {
  id           String   @id @default(uuid())
  orgId        String
  periodStart  DateTime
  periodEnd    DateTime
  status       PayrollStatus  // DRAFT PENDING_APPROVAL APPROVED PAID
  totalGross   Decimal
  totalNet     Decimal
  lines        PayrollLine[]
  approvedById String?
}

model PayrollLine {
  id           String   @id @default(uuid())
  runId        String
  userId       String
  contractId   String
  base         Decimal
  commissions  Decimal
  bonuses      Decimal
  deductions   Decimal
  advances     Decimal
  statutory    Decimal
  net          Decimal
  breakdown    Json     // full source records
}
```

**Every table links back to real records. No line is typed without a source.**

---

## PART G — PERMISSION MATRIX (Finance Manager vs everyone)

| Action | FM | Accountant | Owner | Admin | HR | Fleet | Driver | Rider |
|---|---|---|---|---|---|---|---|---|
| Create requisition | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve requisition ≤20k | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve requisition >100k | ✅ | ❌ | ✅ (co) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Execute payment | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve expense | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve refund | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve payroll run | ✅ | ❌ | ✅ | ❌ | prepare | ❌ | ❌ | ❌ |
| Execute payroll | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve owner statement | ✅ | prepare | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Execute owner payout | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve deposit forfeiture | ✅ | ❌ | ✅ (co) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ✅ (co) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Post journal entry | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View own money | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| View company reports | ✅ | ✅ | ✅ | ✅ | limited | limited | ❌ | ❌ |
| Export reports | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | own | own |

**Enforced at the API layer** — every endpoint checks role + scope + record ownership. Hiding UI is never the security layer (per Master Spec §10).

---

## PART H — THE MONEY FLOW END-TO-END (one worked example)

A driver needs fuel for a trip; the fuel is company-paid; the trip earns revenue; the owner gets a statement; the driver gets commission.

```
1. Driver raises REQ-08 FUEL_ADVANCE 30







# ARTIC VMS — Finance Manager Authority Limits, Initiation Rights & Approval Compatibility

This extends Part A–H above. The key correction: **the Finance Manager is not only an approver — the Finance Manager can initiate and complete money movement within limits configured by the Company Admin.** Beyond those limits (amount, frequency, aggregate periods, direction), the movement requires Company Admin (and/or Company Owner) approval before it completes.

This must work **compatibly across every scenario**: every requisition type, every money flow, every ownership model, every contract, every role — with no contradiction between "FM can act alone" and "Admin must approve."

---

## PART I — THE THREE AUTHORITY MODES

Every money movement falls into exactly one of three modes at the moment it is created:

| Mode | Who initiates | Who approves | Completes when |
|---|---|---|---|
| **A — AUTO** | FM (or requester) | Nobody (within limit) | Immediately / on schedule |
| **B — FM_INITIATED + ADMIN_APPROVAL** | FM | Company Admin (+ Owner if configured) | After admin approval |
| **C — THIRD_PARTY_INITIATED + FM_APPROVAL** | Any other role | FM (+ Admin if over FM limit) | After FM approval (and Admin if needed) |

```
                         ┌──────────────────────────────┐
  Any money movement ───▶│ Evaluate against Admin Policy │
                         │ (limits · frequency · period) │
                         └──────────────┬───────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  Within FM limits              Above FM limits                Initiated by non-FM
  ─────────────────            ─────────────────             ────────────────────
  MODE A: AUTO                 MODE B: FM + Admin            MODE C: Requester + FM
  FM initiates & completes     FM initiates, Admin approves  (+ Admin if over FM limit)
```

**Compatibility rule:** Mode C flows that exceed the FM limit become **Mode C + B chained** — requester → FM approves → Admin approves → completes. The system must never have two conflicting approval chains; it composes them.

---

## PART J — THE ADMIN POLICY ENGINE (configurable per organization)

The Company Admin configures a **Finance Policy** at `/settings/finance-policy`. Every money movement is evaluated against it. The policy is versioned; changing it never retroactively alters in-flight movements.

### J.1 Policy axes

```
FinancePolicy
├── direction            IN | OUT | BOTH
├── flow                 (per money flow — 11 flows from Part B)
├── limit                amount (RWF)
├── frequency
│     ├── per_transaction_max
│     ├── per_day_count / per_day_amount
│     ├── per_week_count / per_week_amount
│     ├── per_month_count / per_month_amount
│     ├── per_quarter_count / per_quarter_amount
│     └── per_year_count / per_year_amount
├── approver_chain       [ADMIN] | [ADMIN, OWNER] | [OWNER]
├── require_two_person   boolean
├── allowed_methods      [CASH, MOMO, BANK, CARD]
├── allowed_recipients   (e.g., no cash payouts to non-staff)
├── time_window          (e.g., business hours only for cash)
└── escalation_on_breach HOLD | REJECT | REQUIRE_APPROVAL
```

### J.2 Example policy (Company "Kigali Motors Ltd")

```
┌─────────────────────────────────────────────────────────────┐
│ Finance policy · Kigali Motors Ltd        v3 · 1 Oct 2026   │
├─────────────────────────────────────────────────────────────┤
│ FINANCE MANAGER AUTHORITY (money OUT)                       │
│  Per transaction max:            RWF 100,000                │
│  Per day:      5 txns / RWF 300,000                         │
│  Per week:    15 txns / RWF 800,000                         │
│  Per month:   50 txns / RWF 2,500,000                       │
│  Per quarter:150 txns / RWF 7,000,000                       │
│  Per year:   600 txns / RWF 25,000,000                      │
│                                                             │
│  If exceeded → [Require Admin approval ▾]                   │
│  If exceeded twice in a week → Require Admin + Owner        │
│                                                             │
│ FINANCE MANAGER AUTHORITY (money IN)                        │
│  Per transaction max:            RWF 500,000                │
│  Per day:     10 txns / RWF 1,000,000                       │
│  Per week:    40 txns / RWF 4,000,000                       │
│  (Refunds always require Admin, regardless of limit)        │
│                                                             │
│ PER-FLOW OVERRIDES                                          │
│  Driver payout:        max RWF 80,000 / txn (Admin above)   │
│  Owner payout:         always Admin + Owner                 │
│  Refund:               always Admin                         │
│  Payroll execution:    always Admin + Owner                 │
│  Deposit forfeiture:   always Admin + Owner                 │
│  Ownership transfer:   always Admin + Owner                 │
│  Internal transfer:    FM alone (no limit)                  │
│                                                             │
│ METHODS                                                     │
│  Cash out:  ≤ RWF 50,000, business hours only               │
│  MoMo out:  any                                              │
│  Bank out:  any                                              │
│                                                             │
│ [Save policy]  [View change history]                        │
└─────────────────────────────────────────────────────────────┘
```

### J.3 How the engine evaluates (deterministic order)

For any money movement, the engine runs this sequence and stops at the first breach:

```
1. Is the flow allowed at all for this role?        → no = REJECT
2. Is the method allowed?                           → no = REQUIRE_APPROVAL
3. per_transaction_max breached?                    → yes = per policy escalation
4. per_day count/amount breached (incl. this txn)?  → yes = escalate
5. per_week count/amount breached?                  → yes = escalate
6. per_month / per_quarter / per_year breached?     → yes = escalate
7. Is flow in always-approve list?                  → yes = escalate
8. Does policy require two_person?                  → yes = escalate
9. Otherwise                                        → AUTO (Mode A)
```

"Escalate" = `HOLD` / `REJECT` / `REQUIRE_APPROVAL` as configured. The result is stamped onto the movement record as `authorityDecision` with the rule that fired, so the audit trail always explains *why* an approval was or wasn't required.

### J.4 Rolling-window counters

Counters are computed from **real transaction records**, never cached counters that can drift:

```
week_count = count(payments where org=X and created_at ∈ [start_of_week, now]
                   and initiated_by=FM and direction=OUT and status∈{PAID,SCHEDULED})
```

- **Both directions tracked separately** (IN and OUT never share a counter).
- **Scheduled but not yet paid** movements count toward the limit at creation time (prevents "schedule 100 payments then approve all").
- **Rejected/voided** movements do **not** count.
- **Refunds** count as OUT.
- **Internal transfers** are excluded (they don't leave the company).
- **Owner payouts** count toward OUT limits but always require Admin anyway.
- Quarter boundaries are calendar quarters; year is calendar year.

### J.5 What "frequency" means precisely

The admin sets **both count and amount** per period. Either breach escalates. Example: FM limit "5/day, RWF 300,000/day" → the 6th transaction of the day **or** the transaction that pushes the day's total over RWF 300,000 both escalate. The system shows both counters live in the FM's header:

```
FM authority today: 3/5 txns · RWF 180,000/300,000
This week:          8/15 txns · RWF 520,000/800,000
```

---

## PART K — FINANCE MANAGER INITIATION (Mode A & B)

### K.1 What the FM can initiate directly

The FM has an "Initiate money movement" button on every relevant page and a unified `/finance/initiate` page:

```
┌─────────────────────────────────────────────────────────────┐
│ Initiate money movement                                     │
├─────────────────────────────────────────────────────────────┤
│ Direction:  ◉ Out   ○ In                                    │
│ Flow:       [Driver payout ▾]                               │
│ Amount:     [45,000] RWF                                    │
│ Recipient:  [Jean M. (Driver) ▾]                            │
│ Method:     [Mobile money ▾]                                │
│ Linked to:  [TRP-1042 ▾]  (required for this flow)          │
│ Reason:     [Commission for trip]                           │
│                                                             │
│ AUTHORITY CHECK (live)                                      │
│ ✅ Within per-transaction limit (100,000)                   │
│ ✅ Daily: 4/5 · RWF 225,000/300,000                         │
│ ✅ Weekly: 9/15 · RWF 565,000/800,000                       │
│ ⚠️ This will be the 5th of 5 today                          │
│ RESULT: AUTO — will complete immediately                    │
│                                                             │
│ [Initiate & complete]  [Save draft]                         │
└─────────────────────────────────────────────────────────────┘
```

When the result is **AUTO**, the FM clicks once and the payment posts, reconciles against the linked record, and appears in reports. This is the "FM can initiate and it finishes" requirement.

When the result is **Mode B**, the button changes to **"Submit for Admin approval"** and the movement enters the Admin's approval queue with the FM as initiator.

### K.2 FM-initiated flows that always need Admin (regardless of amount)

These are configured in policy, but the defaults reflect risk:

- Owner payouts
- Payroll execution
- Refunds
- Deposit forfeiture
- Ownership transfer
- Any cash out above the cash threshold
- Second breach in a week

The FM can still **initiate** them — they simply route to Admin for final approval.

### K.3 FM cannot approve what the FM initiated

Enforced at DB level: `Approval.approverId ≠ Requisition.initiatorId` for FM-initiated movements. An FM-initiated Mode B movement is approved by Admin/Owner only.

---

## PART L — COMPANY ADMIN APPROVAL (Mode B)

### L.1 Admin approval queue `/admin/finance-approvals`

```
┌─────────────────────────────────────────────────────────────┐
│ Finance approvals (initiated by Finance Manager)            │
│ [Pending 4] [Approved] [Rejected] [Over-limit history]      │
├─────────────────────────────────────────────────────────────┤
│ #       │ Flow          │ Amount  │ FM    │ Rule fired      │
├─────────┼───────────────┼─────────┼───────┼─────────────────┤
│ FM-221  │ Owner payout  │ 273,000 │ Sarah │ Always-admin    │
│ FM-220  │ Refund        │ 120,000 │ Sarah │ Always-admin    │
│ FM-219  │ Driver payout │  95,000 │ Sarah │ >80k driver cap │
│ FM-218  │ Expense       │ 340,000 │ Sarah │ >100k txn max   │
└─────────────────────────────────────────────────────────────┘
```

Each row shows **the exact rule that fired**, so the Admin approves with full context. Clicking opens the movement with:
- Full linked records (trip, vehicle, agreement, statement)
- FM's authority usage at time of initiation
- FM's reason
- Audit trail

Admin decisions: **Approve** / **Reject (reason)** / **Request changes**. On approve, the movement completes under the same execution path as Mode A.

### L.2 Admin cannot silently override limits

The Admin can approve individual movements but **cannot** change the policy without going through the policy edit flow (which is itself audited and may require Owner co-approval depending on org settings). This prevents an Admin from quietly raising the FM limit to bypass control.

### L.3 Owner as second approver

When policy requires `[ADMIN, OWNER]`, the chain is sequential: FM initiates → Admin approves → Owner approves → completes. Any rejection stops the chain. The movement record shows all three actors.

---

## PART M — MODE C COMPOSITION (requester → FM → Admin)

This is where compatibility matters most. When a non-FM role initiates a movement:

```
Driver raises REQ-08 (fuel advance 30,000)
        │
        ▼
  FM evaluates the requester's request against:
   • the requester's role caps
   • the flow rules
   • the FM's own remaining authority
        │
        ├── FM approves AND it stays within FM authority → AUTO complete (Mode C→A)
        │
        └── FM approves BUT it pushes FM over a limit
                 → movement becomes FM-initiated Mode B
                 → routes to Admin
                 → completes after Admin approval (Mode C→B)
```

**The system must not double-count.** When the FM approves a requester's movement and it subsequently needs Admin approval, the movement is counted **once** against the FM's authority (at the moment the FM approves it), not again when Admin approves. The requester's request and the resulting payment are the same logical movement with a chain of approvals — the engine tracks it as one `money_movement` with `approvals[]`.

### M.1 Unified money-movement record

To make all three modes compatible, every money movement (regardless of origin) is stored as one record:

```
MoneyMovement
  ├── id
  ├── orgId
  ├── direction            IN | OUT | INTERNAL
  ├── flow                 (11 flows)
  ├── amount
  ├── initiatorId          (who first created it)
  ├── initiatorRole        FM | DRIVER | HR | ...
  ├── authorityMode        A | B | C | C_B
  ├── authorityDecision    { rule, limit, usageAtTime }
  ├── approvals[]          (ordered chain, each {approver, role, decision, at})
  ├── status               (state machine)
  ├── linkedRecords        { vehicle, trip, agreement, statement, contract... }
  ├── payments[]           (actual disbursement records)
  └── audit[]
```

This single record is what the Reports, Reconciliation, Audit trail, and P&L all read — so there is exactly one source of truth and no divergence between "requisition approved" and "payment made."

### M.2 State machine (unified, all modes)

```
DRAFT → SUBMITTED
SUBMITTED → {AUTO_COMPLETE | AWAITING_FM | AWAITING_ADMIN | AWAITING_OWNER}
AWAITING_FM → APPROVED_BY_FM → (re-evaluate authority)
               → AUTO_COMPLETE  (still within FM limits)
               → AWAITING_ADMIN (exceeds limits)
AWAITING_ADMIN → APPROVED_BY_ADMIN → AWAITING_OWNER? → COMPLETE
               → REJECTED
AWAITING_OWNER → APPROVED_BY_OWNER → COMPLETE | REJECTED
Any → ON_HOLD | CANCELLED (by initiator while not yet complete) | VOID (FM, audited)
COMPLETE → RECONCILED
```

Every transition is logged with actor, role, timestamp, and the authority rule in force.

---

## PART N — COMPATIBILITY ACROSS ALL SCENARIOS (the verification matrix)

This is the part that proves the system supports every combination without conflict.

### N.1 Direction × Flow × Mode

| Flow | Direction | Default mode | If over FM limit | If initiated by non-FM |
|---|---|---|---|---|
| Customer payment in | IN | A (auto-reconcile) | B (Admin) | C (FM) |
| Refund | OUT | B (always Admin) | B + Owner | C→B |
| Deposit hold | IN | A | B | C |
| Deposit refund | OUT | B | B + Owner | C→B |
| Driver pay | OUT | A / B per amount | B | C→B if over |
| Salary / payroll | OUT | B (always Admin+Owner) | — | C→B (HR prepares) |
| Expense | OUT | A / B per amount | B | C→B if over |
| Requisition advance | OUT | A / B per amount | B | C→B if over |
| Owner payout | OUT | B (always Admin+Owner) | — | system-generated → FM review → B |
| Supplier payment | OUT | A / B per amount | B | C→B if over |
| Platform subscription | OUT | A (FM or Owner) | B | — |
| Internal transfer | INTERNAL | A (FM only) | — | FM only |

No cell is undefined — every combination resolves to a mode.

### N.2 Contract-type × payout compatibility

| Contract / ownership | Flow | FM initiates? | Admin approval needed? | Notes |
|---|---|---|---|---|
| Driver FIXED_SALARY | Payroll | prepares, Owner executes | Yes (always) | Owner executes per policy |
| Driver COMMISSION_PCT | Driver pay | Yes, within limits | Only if over limit | Per-trip computed |
| Driver PER_TRIP | Driver pay | Yes | Only if over | |
| Driver HYBRID | Payroll + driver pay | Both | Payroll always; commission per limit | Two components, one movement each |
| Driver PER_DAY | Payroll | prepares | Yes | Attendance-driven |
| Rider REMITTANCE | IN (remittance) | Yes | Only over IN limit | Shortfall → deduction → OUT |
| Owner MANAGEMENT_FEE_FIXED | Owner payout | Yes (initiates) | Yes (always Admin+Owner) | Fee computed from agreement |
| Owner MANAGEMENT_FEE_PCT | Owner payout | Yes | Yes | % fee |
| Owner LEASE_TO_COMPANY | Owner payout (lease) | Yes | Yes | Fixed lease |
| Owner HIRE_PURCHASE | Customer installment in | A (auto) | Over IN limit → B | Ownership transfer at end → B |
| Owner PROFIT_SHARE | Owner payout | Yes | Yes | Split after costs |
| Company-owned vehicle | Company profit | — (internal) | — | No payout |
| Company sells to customer | Installment in | A | Over IN limit → B | Transfer → B |
| Owner SELF_DRIVE | Fee/remittance in | A | Over IN limit → B | Owner pays company |
| Third-party subcontract | Subcontractor pay | Yes | Over limit → B | Linked to job |

Every contract type has a defined mode and a defined approval need — no ambiguity.

### N.3 Role × money-action compatibility

| Initiator | Can initiate? | FM approval? | Admin approval? |
|---|---|---|---|
| FINANCE_MANAGER | Yes | — (self) | Per policy / always-list |
| ACCOUNTANT | Yes (records) | Yes | Per policy after FM |
| COMPANY_OWNER | Yes | No (Owner) | No (Owner is top) |
| COMPANY_ADMIN | Yes | Yes (FM) | — (self, but not for own-initiated? see below) |
| HR_MANAGER | Prepares payroll | Yes | Yes |
| FLEET_MANAGER | Requests expenses | Yes | Per policy after FM |
| DISPATCHER | Requests trip costs | Yes | Per policy after FM |
| MECHANIC | Requests parts | Yes | Per policy after FM |
| RENTAL_MANAGER | Requests refunds | Yes | Yes (refunds always Admin) |
| SALES_AGENT | Requests commission | Yes | Per policy after FM |
| DRIVER | Requests advance/per-diem | Yes | Per policy after FM |
| RIDER | Records collection | Yes (reconciliation) | Per policy |
| CUSTOMER | Pays / requests refund | Yes (FM) | Refund always Admin |
| VEHICLE_OWNER | Views statement | — | Payout always Admin+Owner |

**Admin self-initiation rule:** If the Company Admin initiates a money movement themselves, they cannot approve it. It routes to FM (for financial review) and, if it exceeds the FM limit, to Owner. This closes the "Admin approves own spending" hole.

### N.4 Period-boundary compatibility

| Situation | Behavior |
|---|---|
| FM limit resets Monday 00:00 | Counters use calendar week (configurable week start) |
| Movement initiated Sunday 23:59, approved Monday | Counts toward **initiation** week (when FM acted) |
| Scheduled payment next month | Counts at **creation/scheduling** time, not payout time |
| Rejected movement | Released from counters immediately |
| Voided after paid | Counts (money did move); reversal recorded separately |
| Refund of a payment | Counts as new OUT movement |
| Two FMs in same org | Each has own counters; org total also tracked |
| Policy changed mid-period | In-flight movements keep the rule that was in force at initiation |

### N.5 Multi-company compatibility

A user who is FM in Company A and Admin in Company B has **two separate authority profiles**. The `MoneyMovement` is always bound to one `orgId`. The workspace switcher changes which policy applies. No cross-company counter bleed.

### N.6 Multi-FM compatibility

If an org has more than one Finance Manager, limits apply **per FM** by default, with an optional **org-level aggregate cap** in policy:

```
Org aggregate FM authority (all FMs combined):
  per day:   RWF 500,000
  per week:  RWF 1,500,000
```
A movement that keeps one FM within personal limits but pushes the org aggregate over escalates to Admin. This prevents splitting movements across two FMs to bypass limits.

### N.7 Concurrency & race conditions

- Limit counters are evaluated in a **transaction** with row-level lock on the org's authority ledger at initiation time.
- Two FMs initiating simultaneously cannot both slip under the same day limit — the second sees the first's committed movement.
- Scheduled movements reserve authority at creation; if a later FM wants to initiate and the reserved amount would breach, the new one escalates rather than the scheduled one silently failing.

### N.8 Reversal, correction, and dispute compatibility

| Event | Effect on authority | Approval |
|---|---|---|
| Movement voided before complete | Counter released | FM, audited |
| Movement reversed after paid | Original counts; reversal is new IN movement | FM (+Admin if over IN limit) |
| Chargeback / dispute | New OUT/IN movement | Per flow rules |
| Correction of amount | Original voided + new created | Both audited; counters recompute |

### N.9 Reports compatibility

Every report reads the unified `MoneyMovement` record, so:
- **P&L** uses completed OUT movements (not requisitions).
- **Authority usage report** shows per-FM usage vs limits by period, with the rule that fired on each escalated movement.
- **Approval audit trail** shows the full chain (initiator → FM → Admin → Owner) with timestamps and device info.
- **Over-limit report** lists every movement that breached FM limits this period, so Admin can review whether the policy is right-sized.
- **Policy change history** shows every edit to the Finance Policy with the Admin who made it.

---

## PART O — UI ADDITIONS

### O.1 FM header authority widget (always visible on finance pages)

```
┌─────────────────────────────────────────────────────────────┐
│ Finance · Kigali Motors   Sarah (FM)                        │
│ Authority today: 3/5 txns · RWF 180,000/300,000  ● OK       │
│ This week:       8/15 txns · RWF 520,000/800,000 ● OK       │
│ [View policy]  [Over-limit history]                         │
└─────────────────────────────────────────────────────────────┘
```

Color state: green OK, amber near limit (≥80%), red breached (next movement escalates).

### O.2 Initiate dialog shows live evaluation (Part K.1) — the FM always knows before clicking whether it will complete or route to Admin.

### O.3 Admin policy editor `/settings/finance-policy`

- Per-flow, per-direction limits for amount and count across day/week/month/quarter/year
- Always-approve list
- Escalation behavior
- Two-person toggle
- Method restrictions
- Org aggregate caps
- Version history with diff view
- Requires Owner co-approval to change if org setting says so

### O.4 Unified approvals inbox (replaces E.6)

Now shows **all** movements awaiting any actor, filtered by "awaiting me":
- FM sees requester-initiated movements (Mode C)
- Admin sees FM-initiated over-limit movements (Mode B)
- Owner sees payroll / owner payout / high-value (Mode B with Owner)

Each row shows the rule that fired and the authority context.

---

## PART P — DATABASE ADDITIONS

```prisma
model FinancePolicy {
  id              String   @id @default(uuid())
  orgId           String
  version         Int
  effectiveFrom   DateTime
  effectiveTo     DateTime?
  rules           Json     // per flow/direction limits + escalation + always-approve
  orgAggregate    Json?    // combined-FM caps
  methodRules     Json?
  createdById     String
  approvedById    String?  // Owner co-approval if required
  createdAt       DateTime @default(now())
}

model MoneyMovement {
  id              String   @id @default(uuid())
  orgId           String
  number          String
  direction       Direction          // IN | OUT | INTERNAL
  flow            Flow
  amount          Decimal
  currency        String @default("RWF")
  initiatorId     String
  initiatorRole   String
  authorityMode   AuthorityMode      // A | B | C | C_B
  authorityRule   Json               // {rule, limit, usageAtTime, policyVersion}
  status          MovementStatus
  linkedRecords   Json
  reason          String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  approvals       MovementApproval[]
  payments        Payment[]
  audit           Json[]
}

model MovementApproval {
  id            String   @id @default(uuid())
  movementId    String
  approverId    String
  approverRole  String
  sequence      Int
  decision      Decision
  reason        String?
  authorityCtx  Json
  createdAt     DateTime @default(now())
}

model AuthorityLedger {
  id            String   @id @default(uuid())
  orgId         String
  userId        String   // the FM
  periodType    String   // DAY | WEEK | MONTH | QUARTER | YEAR
  periodStart   DateTime
  direction     Direction
  count         Int      @default(0)
  amount        Decimal  @default(0)
  @@unique([orgId, userId, periodType, periodStart, direction])
}
```

- `AuthorityLedger` is updated **inside the same DB transaction** that creates the movement, with a row lock — guaranteeing no double-spend of authority.
- `FinancePolicy` is versioned; `MoneyMovement.authorityRule.policyVersion` records which version applied.
- `MovementApproval.sequence` enforces the ordered chain (FM → Admin → Owner).

---

## PART Q — SECURITY & AUDIT RULES (non-negotiable)

1. **Initiator ≠ approver** at every step, enforced in DB.
2. **Authority is reserved at initiation**, not at completion — a scheduled movement holds its slot.
3. **Policy changes are audited** and can require Owner co-approval.
4. **Every movement stores the exact rule that fired**, so "why did this need approval?" is always answerable years later.
5. **Super Admin cannot bypass company policy** — platform-level access to company finance is read-only and logged.
6. **Over-limit movements cannot be auto-approved retroactively** — the chain must run forward.
7. **Voiding after completion requires FM + Admin** and creates a reversal movement, never an edit.
8. **Reports never read requisitions** — they read `MoneyMovement` (completed) so P&L and cash reports cannot diverge.
9. **Counters are derived from the ledger table**, not app memory — restarting a service cannot reset authority usage.
10. **Timezone:** all period boundaries use the org's configured timezone, stored with the policy.

---

## PART R — WORKED END-TO-END EXAMPLES

### R.1 FM initiates within limits → completes (Mode A)

```
Sarah (FM) initiates driver payout RWF 45,000 to Jean M.
  per_txn max 100k ✅ · day 3/5 → 4/5 ✅ · week 8/15 → 9/15 ✅
  Result: AUTO
  → Payment created, linked to TRP-1042, status COMPLETE
  → AuthorityLedger incremented (DAY, WEEK, MONTH, QUARTER, YEAR)
  → Appears in driver payment history, P&L, reconciliation
  → Jean notified, payout executed
```

### R.2 FM initiates over per-transaction limit → Admin approves (Mode B)

```
Sarah initiates expense RWF 340,000 (fuel bulk purchase)
  per_txn max 100k ❌ → escalate REQUIRE_APPROVAL
  Result: AWAITING_ADMIN (Mode B)
  → Admin sees FM-218 with rule ">100k txn max"
  → Admin approves → COMPLETE
  → AuthorityLedger counts the OUT movement once (against FM)
```

### R.3 Requester → FM → over FM limit → Admin (Mode C→B)

```
Driver raises REQ-08 fuel advance RWF 30,000
  → FM approves; FM's day usage is already 4/5
  → This would make 5/5 — still within, so AUTO completes
  (If FM were at 5/5, FM approval would escalate to Admin)
```

### R.4 Refund always needs Admin

```
Customer requests refund RWF 120,000
  → Rental Mgr raises REFUND requisition
  → FM reviews and approves (within FM authority)
  → Policy: refunds always Admin → AWAITING_ADMIN
  → Admin approves → COMPLETE
```

### R.5 Owner payout always Admin + Owner

```
System generates owner statement for Alex K. (net RWF 273,000)
  → FM reviews statement, approves
  → Policy: owner payout always Admin+Owner
  → Admin approves → Owner approves → payout executes
  → Ownership record untouched; statement status PAID
```

### R.6 Hire-purchase completion → ownership transfer

```
Customer final installment (installment 12/12) paid → AUTO IN
  → System checks transfer conditions (paid, fee, docs)
  → FM initiates ownership transfer
  → Policy: always Admin+Owner → both approve
  → VehicleOwnership updated: CUSTOMER
  → Transfer certificate PDF generated (branded)
  → Owner statement closed; company records release
```

### R.7 Second breach in a week

```
FM already breached twice this week (both admin-approved)
  → Next over-limit movement → policy requires Admin + Owner
  → FM initiates → Admin approves → Owner approves → COMPLETE
```

### R.8 Admin initiates own spending

```
Admin raises RWF 200,000 expense for office equipment
  → Cannot self-approve → routes to FM
  → FM reviews; over FM limit? if yes → routes to Owner
  → Completes after proper chain
```

---

## PART S — WHAT THIS GUARANTEES

- **FM autonomy where it's safe:** daily operations (driver pay within caps, small expenses, internal transfers) complete instantly without Admin friction.
- **Admin control where it matters:** limits by amount, count, period (day/week/month/quarter/year), direction, flow, method, and always-approve lists.
- **No bypass:** counters are DB-backed with row locks; initiator ≠ approver at every step; policy changes audited.
- **Full compatibility:** all 11 flows, all contract types, all ownership models, all roles, multi-FM, multi-company, reversals, disputes, scheduled payments — each resolves to exactly one mode with a defined approval chain.
- **Explainability:** every movement stores the rule that fired, so audits and disputes can always reconstruct *why* approval was or wasn't needed.

The Finance Manager becomes a **bounded autonomous actor**: empowered to run the company's money day to day, and automatically escalated to Admin/Owner exactly when the Admin's policy says the risk exceeds what the FM should decide alone.









# ARTIC VMS — Complete Finance Role System (A to Z)

This is the full, standalone specification of **every finance role** in ARTIC VMS, end to end: who exists, what each owns, what each can initiate, approve, execute, see, and export — and how all of them compose without conflict. It supersedes and consolidates the role material in Parts A–S and the earlier Finance spec.

---

# SECTION A — FINANCE ROLE CATALOGUE (the complete list)

There are **fourteen (14) finance-relevant roles**. They split into three tiers: **platform**, **company finance**, and **money-touching operational roles** (non-finance roles that raise or receive money).

## A.1 Platform tier (2 roles)

| # | Role | Scope | Finance purpose |
|---|---|---|---|
| 1 | `SUPER_ADMIN` | All companies | Owns platform billing, approves companies, sees platform revenue, can view (read-only, logged) any company's finance for support |
| 2 | `PLATFORM_SUPPORT` | Ticket-scoped | Read-only, time-bounded, audited access to a company's finance to resolve a support ticket |

## A.2 Company finance tier (5 roles)

| # | Role | Scope | Finance purpose |
|---|---|---|---|
| 3 | `COMPANY_OWNER` | One company | Final authority. Owns equity, approves highest-risk movements, executes payroll and owner payouts, co-approves policy changes |
| 4 | `COMPANY_ADMIN` | One company | Sets the Finance Policy (limits, frequency, always-approve lists), approves FM-initiated over-limit movements, manages finance users |
| 5 | `FINANCE_MANAGER` | One company | Runs day-to-day money: initiates and completes within policy, approves requester movements, prepares payouts, reconciles, owns reports |
| 6 | `ACCOUNTANT` | One company | Records transactions, prepares statements and payroll, posts journals (if granted), cannot approve or execute |
| 7 | `AUDITOR` | One company, time-limited | Read-only across all finance records and audit trails; all access logged |

## A.3 Money-touching operational roles (7 roles)

These are not "finance roles" by title but they **initiate or receive money**, so they are part of the finance system's permission matrix.

| # | Role | Money relationship |
|---|---|---|
| 8 | `HR_MANAGER` | Prepares payroll, proposes salary changes, bonuses, deductions, attendance |
| 9 | `FLEET_MANAGER` | Requests expenses, fuel, maintenance, subcontractor pay, vehicle purchases |
| 10 | `DISPATCHER` | Requests trip costs, per-diem, subcontractor pay |
| 11 | `MECHANIC` | Requests parts, reimbursements, workshop supplier payments |
| 12 | `RENTAL_MANAGER` | Requests refunds, deposit releases, damage charges |
| 13 | `SALES_AGENT` | Requests commission, records sale/installment details |
| 14 | `DRIVER` / `RIDER` | Requests advances, per-diem, fuel; receives pay; records rider remittance |
| — | `CUSTOMER` / `VEHICLE_OWNER` | Pays in, requests refunds, receives owner payouts, views own statements |

---

# SECTION B — ROLE DEFINITIONS IN FULL

Each role is defined by nine attributes: **purpose, scope, authority mode rights, initiate rights, approve rights, execute rights, view rights, export rights, and separation rules.**

---

## B.1 `SUPER_ADMIN`

**Purpose:** Operate the ARTIC platform itself.

**Scope:** Platform-wide. All organizations, all users, all platform billing.

**Authority mode rights:**
- No company Finance Policy applies to the Super Admin.
- Platform-level money movements (company subscriptions, feature add-ons, platform refunds) are initiated and completed by Super Admin within platform billing rules.

**Initiate rights:**
- Platform subscription invoices
- Platform feature entitlement changes (which affect billing)
- Company plan activation/suspension (billing effect)
- Platform-level refunds to companies
- Company approval/rejection (which gates billing start)

**Approve rights:**
- Platform refunds (second approver = platform finance admin if configured)
- Company plan overrides

**Execute rights:**
- Charge company subscriptions (via platform payment provider)
- Issue platform credit notes

**View rights:**
- All platform revenue, all company subscription status, all usage counters
- **Company finance data: read-only, logged, and only via an explicit "support access" action that is audited and time-bounded** — never silently.

**Export rights:**
- Platform revenue reports, subscription reports, company billing history
- **Not** company P&L or company transaction detail unless an audited support grant is active

**Separation rules:**
- Super Admin **cannot** approve a company's internal money movement.
- Super Admin **cannot** alter a company's Finance Policy.
- Every Super Admin access to company finance writes an `audit_log` entry with reason.

---

## B.2 `PLATFORM_SUPPORT`

**Purpose:** Resolve support tickets that require seeing a company's finance.

**Scope:** One ticket at a time; access expires (default 24h) or when the ticket closes.

**Initiate rights:** None.

**Approve rights:** None.

**Execute rights:** None.

**View rights:**
- Read-only view of the specific records linked to the open ticket (e.g., one invoice, one payment, one statement)
- Cannot browse freely; each record view is logged with ticket ID

**Export rights:** None (can copy single values into the ticket, which is logged).

**Separation rules:**
- Access requires an explicit support grant from the company Admin (or Super Admin with audit).
- All views logged with ticket reference, timestamp, and IP.

---

## B.3 `COMPANY_OWNER`

**Purpose:** Legal owner/founder. Final authority for the company's money.

**Scope:** One company (may own several — separate profile per company).

**Authority mode rights:**
- Acts as the **top approver** in every chain.
- Can initiate any money movement (including owner draw, equity movements).
- Cannot self-approve an owner draw — requires Admin co-approval.

**Initiate rights:**
- All flows (especially owner draw, equity, high-value purchases)
- Finance Policy changes (co-approval)
- Role grants that touch finance (assign FM, Accountant, Auditor)

**Approve rights:**
- Every movement requiring Owner in the chain (payroll execution, owner payouts, refunds over threshold, ownership transfers, deposit forfeiture, over-limit second breach, high-value expenses)
- Finance Policy version changes (co-approval with Admin)
- Assignment/removal of Finance Manager, Accountant, Auditor
- Auditor access grants

**Execute rights:**
- Payroll runs (final execution)
- Owner payouts (final execution)
- High-value payments
- Ownership transfers

**View rights:**
- Everything in the company: all finance records, all reports, all audit trails, all policy versions, all authority usage

**Export rights:**
- All reports, all exports (PDF, Excel, CSV)
- Authority usage reports
- Audit trail exports

**Separation rules:**
- Owner-initiated movements cannot be Owner-approved; they route to Admin (and FM for financial review).
- Owner cannot bypass Finance Policy — over-limit movements still need the configured chain, except Owner is the terminal approver.
- Owner draw requires Admin co-approval.

---

## B.4 `COMPANY_ADMIN`

**Purpose:** Day-to-day administrator. Sets the rules under which finance operates.

**Scope:** One company.

**Authority mode rights:**
- Defines the **Finance Policy** (all limits, frequency, periods, always-approve lists, escalation behavior, method rules, org aggregate caps).
- Approves FM-initiated over-limit movements (Mode B).
- Approves refunds (always, per default policy).
- Co-approves Owner draw and high-risk items.

**Initiate rights:**
- Finance Policy changes (co-approval with Owner if org requires)
- User management (create/deactivate finance users)
- Any money movement (but cannot self-approve own-initiated ones)

**Approve rights:**
- Mode B: FM-initiated movements that breach FM authority
- Refunds (always)
- Deposit forfeiture (with Owner)
- Ownership transfer (with Owner)
- Over-limit movements where Admin is in the chain
- FM expense approvals where policy routes to Admin

**Execute rights:**
- None directly for company money — execution is FM or Owner (separation). Admin approves, does not execute.
- Exception: Admin may execute platform subscription payments if configured.

**View rights:**
- All company finance data, all reports, all authority usage, all policy versions, all audit trails

**Export rights:**
- All reports and exports
- Policy change history
- Authority usage and over-limit reports

**Separation rules:**
- Admin-initiated movements cannot be Admin-approved → route to FM (review) and Owner (if over FM limit).
- Admin cannot silently change policy mid-flight to approve a movement — policy changes are versioned and audited, and in-flight movements keep the rule in force at initiation.
- Admin cannot execute payments (no self-approve + self-execute).

---

## B.5 `FINANCE_MANAGER`

**Purpose:** Run the company's money day to day, within the Admin's policy.

**Scope:** One company.

**Authority mode rights:**
- **Mode A (AUTO):** initiate and complete within policy limits.
- **Mode B:** initiate over-limit movements that route to Admin (and Owner if configured).
- **Mode C:** approve requester-initiated movements (composing to B if the approval pushes FM over a limit).

**Initiate rights (all subject to policy evaluation):**
- Customer payments (record), refunds (initiate → always Admin)
- Deposits (record, refund → Admin)
- Driver/rider pay, advances, per-diem, fuel advances
- Salaries (prepare; Owner executes)
- Expenses (record + approve within limits; over → Admin)
- Requisitions (approve requester ones; create own)
- Owner payouts (prepare statement, initiate → always Admin+Owner)
- Supplier/subcontractor payments
- Platform subscription (pay)
- Internal transfers (FM alone)
- Journal entries (if granted)
- Ownership transfer initiation (→ Admin+Owner)
- Deposit forfeiture initiation (→ Admin+Owner)

**Approve rights:**
- Requester-initiated movements (Mode C) within FM authority
- Expenses within FM authority
- Requisitions within FM authority
- Reconciliation matches
- Draft statements and payroll prepared by Accountant/HR (prepare → approve within role)

**Execute rights:**
- Mode A movements (within policy)
- Payments after Admin/Owner approval (execution of approved movements)
- Payout runs within limits
- Reconciliation finalization

**View rights:**
- All company finance data, all reports, authority usage (own and org), audit trail (read)
- Cannot view Owner's personal equity movements unless involved in the chain

**Export rights:**
- All financial reports (P&L, balance sheet, cash flow, trial balance, ageing, profitability, payroll, owner statements, tax, audit trail)
- Requisition register, authority usage report, over-limit history
- PDF and Excel with automatic branding

**Separation rules:**
- FM cannot approve own-initiated movements (enforced in DB).
- FM cannot execute payroll or owner payouts without Admin+Owner approval.
- FM cannot change the Finance Policy (Admin/Owner only).
- FM cannot assign finance roles (Admin/Owner only).
- FM cannot void a completed payment without Admin co-approval (creates a reversal movement).

---

## B.6 `ACCOUNTANT`

**Purpose:** Record and prepare; cannot approve or execute.

**Scope:** One company.

**Authority mode rights:**
- **Mode C only, and only as preparer** — every movement the Accountant records enters `SUBMITTED` and routes to FM for approval.
- Journal entries: posts only if explicitly granted `canPostJournals` by Owner.

**Initiate rights:**
- Record payments (→ FM approve)
- Record expenses (→ FM approve)
- Prepare statements (→ FM approve)
- Prepare payroll (→ FM + Owner)
- Prepare journals (→ FM post if not granted)
- Raise requisitions like any staff (→ FM approve)

**Approve rights:** None.

**Execute rights:** None.

**View rights:**
- All company finance data
- All reports

**Export rights:**
- All reports (PDF, Excel, CSV)
- Cannot export policy change history or role grants

**Separation rules:**
- Accountant can never approve anything, including their own entries.
- Accountant cannot execute payments.
- Accountant cannot view Owner equity movements unless linked.

---

## B.7 `AUDITOR`

**Purpose:** Independent read-only review.

**Scope:** One company, time-limited grant (e.g., 30/90 days), all access logged.

**Authority mode rights:** None.

**Initiate rights:** None.

**Approve rights:** None.

**Execute rights:** None.

**View rights:**
- **Everything:** all movements, all approval chains, all authority usage, all policy versions, all audit trails, all reports, all linked records
- Cannot see raw secrets (bank credentials, payment provider keys) — those are redacted

**Export rights:**
- All reports, all audit trails, all authority usage
- Exports are watermarked "AUDITOR COPY — [name] — [date]" and logged

**Separation rules:**
- Cannot alter anything.
- Grant expires automatically; renewal requires Owner.
- Every view and export logged with IP, timestamp, record set.

---

## B.8 `HR_MANAGER`

**Purpose:** Prepare payroll and staff money proposals; Finance executes.

**Scope:** One company.

**Initiate rights:**
- Payroll runs (prepare → FM → Owner)
- Salary changes (→ FM approve)
- Bonuses/deductions (→ FM approve)
- Attendance adjustments affecting per-day pay
- Leave-without-pay proposals

**Approve rights:** None.

**Execute rights:** None.

**View rights:**
- Staff compensation data (own company)
- Payroll summaries (not full company P&L unless granted)
- Own department cost reports

**Export rights:**
- Payroll summary (staff-level, own company)
- Attendance/compensation reports
- Cannot export full financial statements

**Separation rules:**
- HR cannot approve own proposals.
- HR cannot see other roles' finance beyond compensation.

---

## B.9 `FLEET_MANAGER`

**Purpose:** Request operational spend; never approve it.

**Scope:** One company.

**Initiate rights:**
- Expenses (fuel, maintenance, tolls, insurance, road tax, inspection, tyres, parts, washing, parking, fines, registration, GPS)
- Purchase advances
- Subcontractor pay
- Vehicle purchase requisitions (high value → FM + Admin + Owner)
- Driver deduction requests (→ FM approve)

**Approve rights:** None for money. Can approve **operational** events (work orders, maintenance completion) that trigger cost, but the cost itself is FM-approved.

**Execute rights:** None for money.

**View rights:**
- Own requests and their status
- Vehicle cost history (per vehicle)
- Maintenance/expense reports for own fleet
- Not full P&L

**Export rights:**
- Vehicle cost reports, expense reports for own fleet
- Not company financial statements

**Separation rules:**
- Fleet Manager cannot approve expenses — this is a core rule.
- Fleet Manager-requested expenses that exceed FM limit go FM → Admin automatically.

---

## B.10 `DISPATCHER`

**Purpose:** Request trip costs; assign drivers.

**Scope:** One company.

**Initiate rights:**
- Per-diem requests
- Trip cost requests (fuel, tolls, parking)
- Subcontractor pay requests (hired driver/vehicle for a job)

**Approve rights:** None for money.

**Execute rights:** None for money.

**View rights:**
- Own requests
- Trip cost summaries for trips they dispatched

**Export rights:**
- Trip cost report for own dispatched trips

**Separation rules:** Same as Fleet Manager — requests only.

---

## B.11 `MECHANIC`

**Purpose:** Request parts and workshop spend.

**Scope:** One company (assigned jobs only).

**Initiate rights:**
- Parts purchase advances
- Expense reimbursements (with receipt)
- Workshop supplier payment requests (linked to work order)

**Approve rights:** None.

**Execute rights:** None.

**View rights:**
- Own requests and status
- Work order costs for own jobs

**Export rights:**
- Own work order cost summary

**Separation rules:** Requests only; FM approves.

---

## B.12 `RENTAL_MANAGER`

**Purpose:** Handle rental money events.

**Scope:** One company.

**Initiate rights:**
- Refund requests (→ FM → Admin always)
- Deposit release requests (→ FM → Admin for refunds)
- Damage charge requests (→ FM approve; becomes customer invoice)
- Late fee proposals (→ FM approve)

**Approve rights:** None for money.

**Execute rights:** None for money.

**View rights:**
- Rental revenue, deposits held, refunds, damage charges for own rentals
- Customer payment status for own rentals

**Export rights:**
- Rental revenue report, deposit register (own rentals)

**Separation rules:** Requests only; refunds always require Admin.

---

## B.13 `SALES_AGENT`

**Purpose:** Record sales, request commission.

**Scope:** One company.

**Initiate rights:**
- Commission requests (→ FM approve)
- Sale records (which create invoices → FM approve)
- Installment plan proposals (→ FM approve)

**Approve rights:** None.

**Execute rights:** None.

**View rights:**
- Own sales, commissions, and customer payment status for own sales

**Export rights:**
- Own sales/commission report

**Separation rules:** Requests only; FM approves commission.

---

## B.14 `DRIVER` / `RIDER`

**Purpose:** Earn money, request advances, record rider collections.

**Scope:** Self.

**Initiate rights (Driver):**
- Fuel advance requests
- Per-diem requests
- Salary/commission advance requests
- Expense reimbursement (with receipt)

**Initiate rights (Rider):**
- Daily collection records (which trigger remittance due)
- Advance requests

**Approve rights:** None.

**Execute rights:** None.

**View rights:**
- Own earnings, own advances, own deductions, own payouts
- Own contract terms
- Own trip/remittance history

**Export rights:**
- Own earnings statement (PDF)
- Own advance/payout history

**Separation rules:** Cannot see other drivers' pay. Cannot approve own advance.

---

## B.15 `CUSTOMER` / `VEHICLE_OWNER` (money-facing external roles)

**Customer initiate rights:**
- Pay invoices/agreements (money IN)
- Request refunds (→ FM → Admin)
- Book rentals (creates deposit liability)
- Dispute charges (creates ticket → FM resolves with credit note)

**Customer view rights:**
- Own invoices, payments, deposits, statements, agreements
- Own dispute history

**Customer export rights:**
- Own statements/invoices (PDF)

**Vehicle Owner initiate rights:**
- View statements
- Request statement review (creates ticket → FM)
- Request vehicle withdrawal (→ FM + Admin + Owner)
- Approve/decline management proposals (affects agreement, not money movement directly)

**Vehicle Owner view rights:**
- Own vehicle statements, payouts, agreement terms, responsibility matrix
- Own ownership history

**Vehicle Owner export rights:**
- Own statements (PDF/Excel)

**Separation rules:** External roles can never approve company money movement. Owner payout is always company-side FM+Admin+Owner chain.

---

# SECTION C — MASTER PERMISSION MATRIX

Legend: **I** = initiate, **A** = approve, **E** = execute, **V** = view, **X** = export, **P** = prepare only, **—** = none.

| Capability | SuperAdmin | Owner | Admin | FM | Acct | Auditor | HR | Fleet | Dispatch | Mech | Rental | Sales | Driver/Rider | Customer | Veh.Owner |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **POLICY & GOVERNANCE** | | | | | | | | | | | | | | | |
| Set Finance Policy | — | A(co) | I/A | V | — | V | — | — | — | — | — | — | — | — | — |
| Change policy version | — | A(co) | I | V | — | V | — | — | — | — | — | — | — | — | — |
| Assign FM/Accountant/Auditor | — | A | I | — | — | — | — | — | — | — | — | — | — | — | — |
| Grant Auditor access | — | A | I | — | — | — | — | — | — | — | — | — | — | — | — |
| **MONEY MOVEMENT** | | | | | | | | | | | | | | | |
| Initiate any movement | platform only | I | I | I | I | — | I(payroll) | I(exp) | I(trip) | I(parts) | I(refund) | I(comm) | I(adv) | I(pay) | — |
| Auto-complete within limit | — | — | — | E | — | — | — | — | — | — | — | — | — | — | — |
| Approve FM-initiated over-limit | — | A | A | — | — | — | — | — | — | — | — | — | — | — | — |
| Approve requester-initiated | — | A | A | A | — | — | — | — | — | — | — | — | — | — | — |
| Execute payment | platform | E | — | E | — | — | — | — | — | — | — | — | — | — | — |
| Execute payroll | — | E | — | E | — | — | — | — | — | — | — | — | — | — | — |
| Execute owner payout | — | E | — | E | — | — | — | — | — | — | — | — | — | — | — |
| Issue refund | platform | E | A | I/E | P | — | — | — | — | — | I | — | — | I | — |
| Forfeit deposit | — | A/E | A | I | P | — | — | — | — | — | I | — | — | — | — |
| Transfer ownership | — | A/E | A | I | P | — | — | — | — | — | — | — | — | — | I(request) |
| Internal transfer | — | V | V | I/E | — | V | — | — | — | — | — | — | — | — | — |
| **RECORDING** | | | | | | | | | | | | | | | |
| Record payment | — | — | — | I/E | I | — | — | — | — | — | — | — | — | — | — |
| Record expense | — | — | — | I/A/E | I | — | — | I | I | I | — | — | I | — | — |
| Prepare statement | — | — | — | I/A | P | — | — | — | — | — | — | — | — | — | — |
| Prepare payroll | — | — | — | I/A | P | — | P | — | — | — | — | — | — | — | — |
| Post journal | — | A | A | I/E | I(if granted) | — | — | — | — | — | — | — | — | — | — |
| Reconcile | — | V | V | I/E | V | V | — | — | — | — | — | — | — | — | — |
| **VIEW** | | | | | | | | | | | | | | | |
| All company finance | support only | V | V | V | V | V | — | — | — | — | — | — | — | — | — |
| Own finance | — | V | V | V | V | V | V | V | V | V | V | V | V | V | V |
| Authority usage | — | V | V | V | — | V | — | — | — | — | — | — | — | — | — |
| Audit trail | — | V | V | V | V | V | — | — | — | — | — | — | — | — | — |
| **EXPORT** | | | | | | | | | | | | | | | |
| Full financial statements | platform rev | X | X | X | X | X(wm) | — | — | — | — | — | — | — | — | — |
| Operational finance reports | — | X | X | X | X | X(wm) | payroll | vehicle cost | trip cost | WO cost | rental | own sales | own earnings | own stmt | own stmt |
| Authority/over-limit reports | — | X | X | X | — | X(wm) | — | — | — | — | — | — | — | — | — |
| Policy history | — | X | X | V | — | X(wm) | — | — | — | — | — | — | — | — | — |

---

# SECTION D — APPROVAL CHAINS BY RISK (the canonical routing table)

Every movement's routing is decided by: **who initiated + what flow + what amount + what policy says.**

## D.1 Canonical chains

| Scenario | Chain |
|---|---|
| FM initiates, within all limits | **FM → complete** (Mode A) |
| FM initiates, over per-txn or period limit | **FM → Admin → complete** (Mode B) |
| FM initiates, always-approve flow | **FM → Admin (+Owner) → complete** |
| FM initiates, second breach in a week | **FM → Admin → Owner → complete** |
| Requester initiates, FM approves within FM limit | **Requester → FM → complete** (Mode C→A) |
| Requester initiates, FM approval pushes over limit | **Requester → FM → Admin → complete** (Mode C→B) |
| Accountant records, within FM limit | **Accountant → FM → complete** |
| Accountant records, over limit | **Accountant → FM → Admin → complete** |
| HR prepares payroll | **HR → FM → Owner → complete** |
| Fleet/Dispatcher/Mechanic expense | **Requester → FM → (Admin if over) → complete** |
| Rental Manager refund | **Rental → FM → Admin → complete** (refunds always Admin) |
| Sales commission | **Sales → FM → (Admin if over) → complete** |
| Driver advance | **Driver → FM → (Admin if over) → complete** |
| Rider remittance shortfall | **Rider recorded → FM reviews → deduction at payroll → (Admin if over)** |
| Owner payout | **System statement → FM approves → Admin → Owner → complete** |
| Payroll execution | **HR prepare → FM approve → Owner execute → complete** |
| Deposit forfeiture | **Rental request → FM → Admin → Owner → complete** |
| Ownership transfer | **FM initiate → Admin → Owner → execute → complete** |
| Admin initiates own spend | **Admin → FM review → (Owner if over FM limit) → complete** |
| Owner initiates own draw | **Owner → Admin co-approve → FM executes → complete** |
| Internal transfer | **FM → complete** (FM only, no limit) |
| Platform subscription | **FM or Owner pays → complete** (Owner optional co-approve) |
| Super Admin company access | **Support grant → logged read-only** (no movement) |

## D.2 No-gap guarantee

For every combination of (initiator role × flow × amount), the routing table above resolves to exactly one chain. There is no combination without a defined chain, and no chain where the initiator is also the sole approver.

---

# SECTION E — AUTHORITY LIMITS (who is bounded by what)

| Role | Bounded by Finance Policy? | Bounded by own role caps? | Always-approve flows |
|---|---|---|---|
| FM | **Yes** — amount, count, period, direction, flow, method | Yes (cash limit, etc.) | Owner payout, payroll execution, refund, deposit forfeiture, ownership transfer, second breach |
| Accountant | Yes (but cannot self-approve anyway) | Prepares only | Everything (must be approved) |
| Admin | Bound by Owner for owner draw; cannot self-approve | Yes | Owner draw, high-risk co-approvals |
| Owner | Bound by Admin co-approval for own draw; terminal approver otherwise | Yes | Own draw requires Admin |
| HR | Bound by FM + Owner for payroll | Yes | Payroll |
| Fleet/Dispatcher/Mechanic/Rental/Sales | Bound by FM approval | Yes (role caps) | — |
| Driver/Rider | Bound by FM approval and contract caps | Yes (advance ≤ % of expected pay) | — |
| Customer/Owner(external) | No company policy; their actions create requests | — | — |
| Auditor | No movement rights | — | — |
| Super Admin | Platform rules | — | — |

**Role caps (separate from Finance Policy):** e.g., a driver cannot request an advance > 40% of expected monthly pay; a mechanic cannot request parts > work order authorization; these are validated before FM even sees the request.

---

# SECTION F — WHAT EACH ROLE SEES (navigation & dashboards)

## F.1 Finance Manager — `/finance`

Tabs: **Overview · Requisitions · Invoices · Payments · Expenses · Deposits · Owner Statements · Driver Payments · Payroll · Ownership · Transfers · Platform Billing · Reconciliation · Approvals · Reports**

Header widget: authority usage (today/week/month), policy version, over-limit history link.

## F.2 Company Admin — `/admin`

Tabs: **Overview · Finance Approvals · Finance Policy · Finance Users · Audit · Reports (read)**

Sees: all FM-initiated over-limit movements awaiting approval, policy editor, finance role assignments.

## F.3 Company Owner — `/owner`

Tabs: **Overview · Approvals (final) · Payroll Execution · Owner Payout Execution · Policy Co-approval · Equity · Reports · Audit**

Sees: highest-risk items, execution queues, equity movements.

## F.4 Accountant — `/accounting`

Tabs: **Overview · Record Payment · Record Expense · Prepare Statements · Prepare Payroll · Journals · Reconciliation · Reports**

Cannot see approve/execute buttons anywhere.

## F.5 Auditor — `/audit`

Tabs: **Movements · Approvals · Authority Usage · Policy History · Reports · Exports Log**

Read-only; every page shows "AUDITOR — access logged" banner; grant expiry countdown.

## F.6 HR Manager — `/hr`

Tabs: **Payroll Preparation · Compensation · Adjustments · Attendance · Reports (payroll only)**

## F.7 Fleet / Dispatcher / Mechanic / Rental / Sales — role home pages

Each has a **"My requests"** panel + **"New request"** button + **own cost report** export.

## F.8 Driver / Rider — `/me`

Tabs: **Earnings · Advances · Payouts · Contract · Documents**

Rider also: **Daily remittance** tab.

## F.9 Customer / Vehicle Owner — `/portal`

Customer: **Invoices · Payments · Deposits · Agreements · Disputes**
Vehicle Owner: **Statements · Payouts · Agreement · Ownership · Requests**

---

# SECTION G — THE COMPLETE STATE MACHINE (all roles)

```
                    ┌─────────┐
                    │  DRAFT  │  (creator only)
                    └────┬────┘
                         │ submit
                         ▼
                  ┌─────────────┐
                  │  SUBMITTED  │
                  └──────┬──────┘
        authority engine evaluates
                         │
   ┌─────────┬───────────┼────────────┬─────────────┐
   ▼         ▼           ▼            ▼             ▼
AUTO_    AWAITING_   AWAITING_    AWAITING_     REJECTED
COMPLETE    FM         ADMIN        OWNER        (reason)
   │         │           │            │
   │      approve        │            │
   │         │           │            │
   │    ┌────┴────┐      │            │
   │    ▼         ▼      │            │
   │  still    exceeds   │            │
   │  within   limit     │            │
   │  limit     │        │            │
   │    │       └────────┴────────────┘
   │    │                │
   │    ▼                ▼
   │ COMPLETE ◄────── APPROVED
   │    │
   ▼    ▼
COMPLETE → RECONCILED
   │
   └── VOID/REVERSAL (FM + Admin; audited; creates counter-movement)

Any state (before COMPLETE) → ON_HOLD (approver) | CANCELLED (initiator, if allowed)
```

Every transition writes an `audit_log` row: actor, role, timestamp, from-state, to-state, rule-in-force, IP/device.

---

# SECTION H — REPORTS BY ROLE

| Report | FM | Admin | Owner | Acct | Auditor | HR | Ops roles | Driver/Rider | Customer/Owner |
|---|---|---|---|---|---|---|---|---|---|
| P&L / Balance Sheet / Cash Flow | X | X | X | X | X(wm) | — | — | — | — |
| Trial Balance | X | X | X | X | X(wm) | — | — | — | — |
| Receivables / Payables ageing | X | X | X | X | X(wm) | — | — | — | — |
| Vehicle / Trip profitability | X | X | X | X | X(wm) | — | fleet/trip | own | — |
| Payroll summary | X | X | X | X | X(wm) | X | — | own | — |
| Owner statement summary | X | X | X | X | X(wm) | — | — | — | own |
| Expense breakdown | X | X | X | X | X(wm) | — | own fleet | — | — |
| Tax / VAT return | X | X | X | X | X(wm) | — | — | — | — |
| Requisition register | X | X | X | X | X(wm) | own | own | own | — |
| Authority usage / over-limit | X | X | X | — | X(wm) | — | — | — | — |
| Policy change history | V | X | X | — | X(wm) | — | — | — | — |
| Audit trail (finance) | V | X | X | V | X(wm) | — | — | — | — |
| Deposit register | X | X | X | X | X(wm) | — | rental | — | own |
| Ownership & transfer register | X | X | X | X | X(wm) | — | — | — | own |
| Rider remittance ledger | X | X | X | X | X(wm) | — | — | own | — |
| Own earnings statement | — | — | — | — | — | — | — | X | — |
| Own invoices/statements | — | — | — | — | — | — | — | — | X |

All exports follow the branded PDF/Excel pipeline (Part 3 of the original Finance spec): automatic logo, legal name, tax ID, address, currency, color, timestamp, generated-by, reference number, 5-minute signed URL, audited.

---

# SECTION I — SEPARATION OF DUTIES (the invariants)

These are enforced at the database/API layer, not the UI:

1. **Initiator ≠ approver**, at every step of every chain, for every role.
2. **Admin cannot execute** payments (approve yes, execute no) — except platform subscription if configured.
3. **FM cannot execute** payroll or owner payouts without Admin+Owner approval.
4. **Accountant cannot approve or execute** anything, ever.
5. **Auditor cannot alter** anything, ever; grants expire.
6. **Owner cannot approve own draw** — Admin co-approves.
7. **Admin cannot approve own spending** — routes to FM (and Owner if over FM limit).
8. **Super Admin cannot approve company internal movements** or alter company policy.
9. **Policy changes are versioned**, audited, and require Owner co-approval if configured.
10. **Completed movements cannot be edited** — only voided (FM+Admin) with a reversal movement.
11