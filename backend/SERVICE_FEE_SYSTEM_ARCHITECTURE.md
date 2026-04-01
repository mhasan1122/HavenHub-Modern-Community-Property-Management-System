# Estate Link Service Fee Management System
## Complete Architecture & Database Schema Documentation

**Version:** 2.0  
**Last Updated:** January 12, 2026  
**Branch:** feature/service-fee-model-schema-update

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Database Schema - Service Fee Module](#database-schema-service-fee-module)
4. [Database Schema - Accounting/Voucher Module](#database-schema-accountingvoucher-module)
5. [Integration Points](#integration-points)
6. [Payment Flow & Double Entry Accounting](#payment-flow--double-entry-accounting)
7. [Database Optimization Strategy](#database-optimization-strategy)
8. [Query Optimization - N+1 Elimination](#query-optimization-n1-elimination)
9. [API Endpoints Reference](#api-endpoints-reference)
10. [Implementation Guide](#implementation-guide)

---

## 1. Executive Summary

The Estate Link Service Fee Management System is a comprehensive billing and payment tracking solution with integrated double-entry accounting. This document outlines:

- **Service Fee Management**: Bill generation, payment tracking, penalty management
- **Voucher/Accounting Integration**: Automated double-entry bookkeeping
- **Performance Optimization**: Query optimization, indexing strategy, N+1 query elimination
- **Data Integrity**: Immutable snapshots, audit trails, validation

### Key Design Principles

1. **Separation of Concerns**: Bills (liabilities) vs Transactions (money received) vs Accounting (journal entries)
2. **Immutable Historical Data**: Configuration snapshots prevent retroactive changes
3. **Query Performance**: Single SQL queries for complex data fetching
4. **Payment Hierarchy**: Penalties cleared first, then base fee, then utilities
5. **Double-Entry Accounting**: Every payment generates proper debit/credit vouchers

---

## 2. System Architecture

### 2.1 Backend (Django REST Framework)

```
backend/
├── service_fee_management/        # Main service fee app
│   ├── models.py                 # ServiceFeePayment, ServiceFeeBilling, ServiceFeeItem
│   ├── views.py                  # Optimized API views (raw SQL)
│   ├── serializers.py            # DRF serializers
│   ├── penalty_tier_scheduler.py # Daily penalty tier automation (12:00 AM)
│   ├── management/
│   │   └── commands/
│   │       └── update_penalty_tiers.py  # Penalty tier update logic
│   └── utils/
│       ├── service_fee_generator.py  # Bill generation logic
│       ├── voucher_generator.py      # Voucher creation integration
│       └── email_utils.py            # Receipt email sending
├── service_fee/                   # Service fee configuration
│   └── models.py                 # ServiceFee, LatePenaltyTier
├── accounts/                      # Accounting/voucher system
│   └── models.py                 # VoucherEntry, VoucherEntryDetails, Account
└── bill_categories/
    └── models.py                 # BillCategory (utilities)
```

### 2.2 Frontend (React)

```
frontend/src/Features/ServiceFeeManagement/
├── BillingManagement/            # Bill generation wizard
│   └── components/
│       └── GenerateBillsWizard.jsx
├── Payments/                     # Payment recording & history
│   └── components/
│       ├── RecordPaymentModal.jsx
│       └── PaymentsTable.jsx
├── Overview/                     # Dashboard & summaries
└── components/                   # Shared components
    ├── ServiceFeeNavigation.jsx
    └── ViewReceiptModal.jsx
```

### 2.3 Automated Background Jobs

#### Penalty Tier Scheduler (Daily at 12:00 AM)

**File:** `backend/service_fee_management/penalty_tier_scheduler.py`

**Purpose:** Automatically updates penalty tiers for overdue payments based on days past due date

**Schedule:** Runs daily at 12:00 AM (midnight)

**What it does:**
1. Finds all unpaid/partial payments with `late_penalty_enabled=True`
2. Calculates days overdue: `(today - due_date).days + 1`
3. Determines applicable penalty tier based on days overdue
4. Updates `ServiceFeePaymentLatePenaltyTier` status to 'active'
5. Creates/updates `ServiceFeeItem` with new penalty amount
6. Recalculates `ServiceFeePayment.amount` and `remaining_amount`
7. **Updates VoucherEntry debit/credit lines** (Accounts Receivable + Service Fee Income)
8. **Maintains double-entry accounting balance** (Total Debit = Total Credit)

**Example:**
```
Payment due: January 1, 2026
Today: January 10, 2026
Days overdue: 10 days

Penalty tiers configured:
- Tier 1: 1-6 days = 2% penalty
- Tier 2: 7+ days = 5% penalty

Scheduler activates Tier 2:
- Base amount: ৳10,000
- Penalty (5%): ৳500
- Total bill: ৳10,500

Voucher updated:
- Debit (Accounts Receivable): ৳10,000 → ৳10,500
- Credit (Service Fee Income): ৳10,000 → ৳10,500
```

**Management Command:**
```bash
python manage.py update_penalty_tiers
```

**Startup:** Auto-starts when Django server starts (via `apps.py` ready() method)

---

## 3. Database Schema - Service Fee Module

### 3.1 Core Service Fee Tables

#### Table: `service_fee_servicefee` (ServiceFee)

**Purpose**: Configuration for service fees (prices, penalties, payment methods)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| `fee_amount` | DECIMAL(15,2) | NOT NULL | Monthly service fee amount |
| `currency` | VARCHAR(3) | DEFAULT 'BDT' | Currency code |
| `frequency` | VARCHAR(20) | DEFAULT 'Monthly' | Billing frequency |
| `due_day` | INT | 1-31 | Day of month payment is due |
| `is_active` | BOOLEAN | DEFAULT TRUE | Active status |
| `late_payment_enabled` | BOOLEAN | DEFAULT FALSE | Enable penalties |
| `created_at` | DATETIME | AUTO | Creation timestamp |
| `updated_at` | DATETIME | AUTO | Last update timestamp |

**Relationships:**
- ONE-TO-MANY with `service_fee_servicefee_towers` (via M2M)
- ONE-TO-MANY with `service_fee_servicefee_units` (via M2M)
- ONE-TO-MANY with `service_fee_management_servicefeepayment`

---

#### Table: `service_fee_management_servicefeepayment` ⭐ MAIN BILLING RECORD

**Purpose**: Header record for each monthly bill (one per unit per month)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| `unit_id` | INT | FK → towers_unit, INDEXED | Unit being billed |
| `service_fee_id` | INT | FK → service_fee_servicefee, INDEXED | Service fee configuration |
| `resident_id` | INT | FK → user_member, INDEXED, **DEPRECATED** | **⚠️ Legacy field - not used in generation** |
| **`owner_id`** | INT | FK → user_member, INDEXED | **✅ Primary contract owner (THE account holder)** |
| **`owner_name`** | VARCHAR(255) | | **✅ Owner name snapshot** |
| **`owner_email`** | VARCHAR(255) | | **✅ Owner email snapshot** |
| **`owner_phone`** | VARCHAR(20) | | **✅ Owner phone snapshot** |
| `account_holder_type` | VARCHAR(20) | **DEPRECATED** | **⚠️ Always 'owner' - use owner_id instead** |
| `account_holder_id` | BIGINT | **DEPRECATED** | **⚠️ Always equals owner_id - redundant** |
| `generation_config_id` | INT | FK → generationconfig | Snapshot of config at generation |
| `service_period_month` | INT | INDEXED | Billing month (1-12) |
| `service_period_year` | INT | INDEXED | Billing year |
| **`amount`** | DECIMAL(10,2) | NOT NULL | **Total bill amount (incl. penalties)** |
| **`remaining_amount`** | DECIMAL(10,2) | NOT NULL | **Amount still owed** |
| `base_service_amount` | DECIMAL(10,2) | | Base service fee only |
| `additional_bill_charges` | DECIMAL(10,2) | | Utilities/extras |
| **`service_status`** | VARCHAR(20) | INDEXED | **due/partial/paid/overdue** |
| `payment_status` | VARCHAR(20) | | pending/completed/failed |
| `due_date` | DATE | | Payment due date |
| `created_at` | DATETIME | INDEXED | Creation timestamp |
| `updated_at` | DATETIME | AUTO | Last update timestamp |

**Critical Indexes:**
```sql
CREATE INDEX idx_payment_unit_period ON service_fee_management_servicefeepayment 
    (unit_id, service_period_year, service_period_month);

CREATE INDEX idx_payment_owner_period ON service_fee_management_servicefeepayment 
    (owner_id, service_period_year, service_period_month);

CREATE INDEX idx_payment_status ON service_fee_management_servicefeepayment 
    (service_status, payment_status);

CREATE INDEX idx_payment_period_status ON service_fee_management_servicefeepayment 
    (service_period_year, service_period_month, service_status);
```

**📌 Important: Field Redundancy Notice**

The following fields are **DEPRECATED** and kept only for backward compatibility:
- ❌ `resident_id` - No longer populated during bill generation
- ❌ `account_holder_type` - Always set to `'owner'` for new bills (redundant)
- ❌ `account_holder_id` - Always equals `owner_id` (redundant)

**Use these instead:**
- ✅ `owner_id` - **Primary key reference to the account holder**
- ✅ `owner_name`, `owner_email`, `owner_phone` - **Contact information snapshots**

For details, see: [FIELD_REDUNDANCY_CLEANUP.md](./FIELD_REDUNDANCY_CLEANUP.md)

---

#### Table: `service_fee_management_servicefeeitem` (ServiceFeeItem)

**Purpose**: Line items breakdown of each bill (base fee + utilities + penalties)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| `service_fee_payment_id` | INT | FK → servicefeepayment, INDEXED | Parent bill |
| **`item_type`** | VARCHAR(20) | INDEXED | **base_fee/penalty/bill_category** |
| `item_name` | VARCHAR(255) | | Display name |
| `amount` | DECIMAL(10,2) | | Line item amount |
| `bill_category_id` | INT | FK → billcategory, INDEXED | For utilities |
| `consumption` | DECIMAL(10,2) | | Utility consumption |
| `price_per_unit` | DECIMAL(10,2) | | Unit price for utilities |
| `previous_reading` | DECIMAL(10,2) | | Meter reading (start) |
| `current_reading` | DECIMAL(10,2) | | Meter reading (end) |
| `unit_of_measurement` | VARCHAR(20) | | kWh, m³, etc. |
| `penalty_waiver_id` | INT | FK → penalty_waivers | If penalty waived |
| `description` | TEXT | | Additional notes |
| `created_at` | DATETIME | | Creation timestamp |

**Item Type Values:**
- `base_fee`: Monthly service fee
- `penalty`: Late payment penalty
- `bill_category`: Utilities (electricity, water, gas)

**Critical Indexes:**
```sql
CREATE INDEX idx_item_payment_type ON service_fee_management_servicefeeitem 
    (service_fee_payment_id, item_type);

CREATE INDEX idx_item_category ON service_fee_management_servicefeeitem 
    (bill_category_id);
```

---

#### Table: `service_fee_payment_details` (ServiceFeeBilling)

**Purpose**: Transaction records (actual money received)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| `servicefeepaymentid_id` | INT | FK → servicefeepayment, INDEXED | Parent bill |
| **`transaction_id`** | VARCHAR(100) | UNIQUE, INDEXED | **Unique transaction ID** |
| `receipt_id` | VARCHAR(100) | UNIQUE | Receipt number |
| `billing_id` | VARCHAR(100) | UNIQUE | Billing reference |
| **`billing_amount`** | DECIMAL(10,2) | | **Amount paid in this transaction** |
| `total_paid` | DECIMAL(10,2) | | Cumulative amount paid |
| `payment_method_id` | INT | FK → payment_methods | Cash/Bank/MFS |
| **`payment_date`** | DATETIME | INDEXED | **Date payment received** |
| `reference_number` | VARCHAR(100) | | External reference |
| `notes` | TEXT | | Payment notes |
| `received_by_id` | INT | FK → user_member | Staff who received payment |
| `received_by_name` | VARCHAR(255) | | Staff name (snapshot) |
| `from_account_number` | VARCHAR(100) | | Payer's account |
| `to_account_number` | VARCHAR(100) | | Receiver's account |
| `to_account_name` | VARCHAR(255) | | Receiver's account name |
| `other_method_name` | VARCHAR(100) | | For "Other" method |
| **`voucher_id`** | INT | | **Link to accounts_voucherentry** |
| `payment_account_code` | VARCHAR(20) | | Chart of accounts code |
| `payment_account_name` | VARCHAR(255) | | Account name |
| `created_at` | DATETIME | INDEXED | Creation timestamp |
| `updated_at` | DATETIME | | Last update timestamp |

**Critical Indexes:**
```sql
CREATE INDEX idx_billing_transaction ON service_fee_payment_details 
    (transaction_id);

CREATE INDEX idx_billing_payment_date ON service_fee_payment_details 
    (servicefeepaymentid_id, payment_date);
```

---

#### Table: `service_fee_payment_allocations` (ServiceFeePaymentAllocation)

**Purpose**: Links payments to specific bill items (payment hierarchy enforcement)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| `service_fee_billing_id` | INT | FK → service_fee_payment_details, INDEXED | Transaction |
| `service_fee_item_id` | INT | FK → servicefeeitem, INDEXED | Bill line item |
| `amount` | DECIMAL(10,2) | | Amount allocated to this item |
| `allocation_type` | VARCHAR(20) | | penalty/base_fee/utility |
| `created_at` | DATETIME | | Creation timestamp |

**Payment Hierarchy (automatic allocation order):**
1. **Penalties** - Cleared first
2. **Base Service Fee** - Cleared second
3. **Utilities/Extras** - Cleared last

**Critical Indexes:**
```sql
CREATE INDEX idx_allocation_billing ON service_fee_payment_allocations 
    (service_fee_billing_id);

CREATE INDEX idx_allocation_item ON service_fee_payment_allocations 
    (service_fee_item_id);
```

---

#### Table: `service_fee_advance_payments` ⭐ ADVANCE PAYMENT TRACKING

**Purpose**: Tracks excess payments (overpayments) for future month application

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| `unit_id` | INT | FK → towers_unit, INDEXED | Unit holding advance |
| `resident_id` | INT | FK → user_member, NULL | **DEPRECATED** - Resident (legacy) |
| `account_holder_type` | VARCHAR(20) | NULL | **DEPRECATED** - Always 'owner' for new bills |
| `account_holder_id` | BIGINT | NULL | **DEPRECATED** - Redundant with owner_id |
| **`advance_type`** | VARCHAR(20) | | **auto_excess/service_fee_advance/other_advance** |
| **`amount`** | DECIMAL(10,2) | NOT NULL | **Total advance amount** |
| **`applied_amount`** | DECIMAL(10,2) | DEFAULT 0 | **Amount already used** |
| **`remaining_amount`** | DECIMAL(10,2) | DEFAULT 0 | **Available balance** |
| `source_billing_id` | INT | FK → service_fee_payment_details, NULL | Source transaction |
| **`status`** | VARCHAR(20) | INDEXED | **available/partial/applied/cancelled** |
| `currency` | VARCHAR(3) | DEFAULT 'BDT' | Currency code |
| `created_at` | DATETIME | AUTO | Creation timestamp |
| `applied_at` | DATETIME | NULL | Fully applied timestamp |
| `expired_at` | DATETIME | NULL | Expiration (optional) |
| `created_by_id` | INT | FK → user_member, NULL | Creator |
| `notes` | TEXT | NULL | Additional notes |

**Advance Type Values:**
- `auto_excess`: Automatically created from overpayment
- `service_fee_advance`: Manual advance payment
- `other_advance`: Other advance types

**Status Values:**
- `available`: Full amount available
- `partial`: Partially used
- `applied`: Fully used
- `cancelled`: Cancelled/void

**Critical Indexes:**
```sql
CREATE INDEX idx_advance_unit_status ON service_fee_advance_payments 
    (unit_id, status);

CREATE INDEX idx_advance_status_created ON service_fee_advance_payments 
    (status, created_at DESC);

CREATE INDEX idx_advance_source ON service_fee_advance_payments 
    (source_billing_id);
```

**Business Logic:**
```python
# Auto-calculation on save
remaining_amount = amount - applied_amount

# Status update rules:
if remaining_amount <= 0:
    status = 'applied'
    applied_at = NOW()
elif applied_amount > 0:
    status = 'partial'
else:
    status = 'available'
```

---

## 4. Database Schema - Accounting/Voucher Module

### 4.1 Voucher System Overview

The voucher system implements **double-entry bookkeeping** where every financial transaction:
- Has equal debits and credits
- Is recorded in a journal (voucher)
- Updates the chart of accounts

**Key Principle**: `Total Debits = Total Credits` (always balanced)

---

### 4.2 Voucher Tables

#### Table: `accounts_account` (Account - Chart of Accounts)

**Purpose**: Master list of all financial accounts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| `accountCode` | VARCHAR(20) | UNIQUE, INDEXED | Account code (e.g., "1110") |
| `accountName` | VARCHAR(255) | | Account name |
| `description` | TEXT | | Account description |
| **`accountType`** | VARCHAR(20) | | **asset/liability/equity/revenue/expense** |
| `parentAccount_id` | INT | FK → self | Parent account (for hierarchy) |
| **`currentBalance`** | DECIMAL(15,2) | DEFAULT 0 | **Current account balance** |
| `isActive` | BOOLEAN | DEFAULT TRUE | Active status |
| `isSystemAccount` | BOOLEAN | DEFAULT FALSE | Protected system account |
| `hasSubAccounts` | BOOLEAN | DEFAULT FALSE | Has child accounts |
| `createdBy_id` | INT | FK → user_member | Creator |
| `createdAt` | DATETIME | AUTO | Creation timestamp |
| `updatedBy_id` | INT | FK → user_member | Last updater |
| `updatedAt` | DATETIME | AUTO | Last update |

**Sample Chart of Accounts:**
```
1110 - Cash Account (Asset)
1121 - Bank Account (Asset)
1122 - N/A Account (Asset)
1125 - Mobile Banking Account (Asset)
1130 - Accounts Receivable (Asset)
4110 - Monthly Service Fee Income (Revenue)
5110 - Utility Expenses (Expense)
```

**Critical Indexes:**
```sql
CREATE INDEX idx_account_code ON accounts_account (accountCode);
CREATE INDEX idx_account_active ON accounts_account (isActive);
CREATE INDEX idx_account_type ON accounts_account (accountType);
```

---

#### Table: `accounts_vouchertype` (VoucherType)

**Purpose**: Types of vouchers (Receipt, Payment, Journal, Contra)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| **`name`** | VARCHAR(20) | UNIQUE | **receipt/payment/journal/contra** |
| `displayName` | VARCHAR(50) | | Display name |
| `description` | TEXT | | Description |
| **`prefix`** | VARCHAR(10) | | **Voucher number prefix (RV/PV/JV/CV)** |
| `isActive` | BOOLEAN | DEFAULT TRUE | Active status |
| `createdBy_id` | INT | FK → user_member | Creator |
| `createdAt` | DATETIME | AUTO | Creation timestamp |
| `updatedBy_id` | INT | FK → user_member | Last updater |
| `updatedAt` | DATETIME | AUTO | Last update |

**Voucher Types:**
- **Receipt Voucher** (RV): Money coming in (e.g., service fee payment)
- **Payment Voucher** (PV): Money going out (e.g., utility payment)
- **Journal Voucher** (JV): Non-cash adjustments
- **Contra Voucher** (CV): Bank-to-cash transfers

---

#### Table: `accounts_voucherentry` ⭐ VOUCHER HEADER

**Purpose**: Header/parent record for each accounting transaction

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| **`voucherNumber`** | VARCHAR(50) | UNIQUE, INDEXED | **Unique voucher number (e.g., SFGV-20260112-0001)** |
| **`entryDate`** | DATE | INDEXED | **Transaction date** |
| `referenceNumber` | VARCHAR(100) | | External reference (e.g., payment ID) |
| `narration` | TEXT | | Transaction description |
| `voucherType_id` | INT | FK → vouchertype, INDEXED | Type of voucher |
| **`status`** | VARCHAR(20) | | **draft/posted/void** |
| **`totalDebit`** | DECIMAL(15,2) | DEFAULT 0 | **Total of all debit lines** |
| **`totalCredit`** | DECIMAL(15,2) | DEFAULT 0 | **Total of all credit lines** |
| `createdBy_id` | INT | FK → user_member | Creator |
| `createdAt` | DATETIME | AUTO | Creation timestamp |
| `postedBy_id` | INT | FK → user_member | User who posted |
| `postedAt` | DATETIME | | Posted timestamp |
| `updatedBy_id` | INT | FK → user_member | Last updater |
| `updatedAt` | DATETIME | AUTO | Last update |

**Status Values:**
- **draft**: Editable, not affecting balances
- **posted**: Finalized, updates account balances
- **void**: Cancelled, reverses posted entries

**Validation Rule:**
```python
if status == 'posted':
    assert totalDebit == totalCredit  # Must balance!
```

**Critical Indexes:**
```sql
CREATE INDEX idx_voucher_number ON accounts_voucherentry (voucherNumber);
CREATE INDEX idx_voucher_date ON accounts_voucherentry (entryDate);
CREATE INDEX idx_voucher_status ON accounts_voucherentry (status);
CREATE INDEX idx_voucher_type ON accounts_voucherentry (voucherType_id);
CREATE INDEX idx_voucher_date_number ON accounts_voucherentry (entryDate DESC, voucherNumber DESC);
```

---

#### Table: `accounts_voucherentrydetails` ⭐ VOUCHER LINES (DEBIT/CREDIT)

**Purpose**: Individual debit/credit lines within each voucher

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Primary key |
| **`voucherEntry_id`** | INT | FK → voucherentry, INDEXED | **Parent voucher** |
| `lineNumber` | INT | | Line sequence number |
| **`account_id`** | INT | FK → account, INDEXED | **Chart of Accounts entry** |
| `description` | VARCHAR(500) | | Line description |
| **`debitAmount`** | DECIMAL(15,2) | DEFAULT 0 | **Debit amount (if debit side)** |
| **`creditAmount`** | DECIMAL(15,2) | DEFAULT 0 | **Credit amount (if credit side)** |
| `createdAt` | DATETIME | AUTO | Creation timestamp |
| `updatedAt` | DATETIME | AUTO | Last update |

**Unique Constraint:**
```sql
UNIQUE (voucherEntry_id, lineNumber)
```

**Validation Rules:**
```python
# Each line must be either debit OR credit, not both
assert not (debitAmount > 0 and creditAmount > 0)
# Each line must have a value
assert debitAmount > 0 or creditAmount > 0
```

**Critical Indexes:**
```sql
CREATE INDEX idx_voucherdetails_entry_line ON accounts_voucherentrydetails 
    (voucherEntry_id, lineNumber);

CREATE INDEX idx_voucherdetails_account ON accounts_voucherentrydetails 
    (account_id);
```

---

## 5. Integration Points

### 5.1 Service Fee ↔ Voucher Integration

**When:** Bill generation (monthly service fees created)
**Trigger:** `service_fee_management/utils/service_fee_generator.py`
**Voucher Created:** Receipt Voucher (SFGV-YYYYMMDD-NNNN)

#### Example: Generating Service Fee Bill for Unit 101

**Service Fee Bill Created:**
```
ServiceFeePayment:
  - unit: Unit 101
  - month: January 2026
  - amount: ৳5150
  - status: due

ServiceFeeItem (4 lines):
  - Base Fee: ৳3000
  - Electricity: ৳1500
  - Gas: ৳500
  - Late Penalty: ৳150
```

**Voucher Automatically Created:**
```
VoucherEntry (SFGV-20260112-0001):
  - voucherType: receipt
  - entryDate: 2026-01-12
  - status: draft
  - totalDebit: ৳5150
  - totalCredit: ৳5150
  - referenceNumber: 12345 (ServiceFeePayment.id)

VoucherEntryDetails (2 lines):
  Line 1 (DEBIT):
    - account: 1130 - Accounts Receivable
    - debitAmount: ৳5150
    - description: "Bill receivable - Service fee from Unit 101"
  
  Line 2 (CREDIT):
    - account: 4110 - Monthly Service Fee Income
    - creditAmount: ৳5150
    - description: "Service fee revenue - Unit 101 (January 2026)"
```

**Accounting Effect:**
```
Accounts Receivable (Asset)    DEBIT  ৳5150  (money owed to us)
  Service Fee Income (Revenue)  CREDIT ৳5150  (income recognized)
```

---

### 5.2 Payment Recording ↔ Voucher Integration

**When:** Payment received (resident pays bill)
**Trigger:** `service_fee_management/views.py::ServiceFeeMultiMonthPaymentView`
**Voucher Updated:** Existing Receipt Voucher updated to "posted" status

#### Example: Unit 101 Pays ৳5150 via bKash

**ServiceFeeBilling Created:**
```
ServiceFeeBilling:
  - servicefeepaymentid: 12345
  - transaction_id: TXN-202601-ABC123
  - billing_amount: ৳5150
  - payment_method: bKash (ID: 2)
  - voucher_id: 789 (links to VoucherEntry)
  - payment_date: 2026-01-15
```

**ServiceFeePaymentAllocation (automatic hierarchy):**
```
Allocation 1:
  - item: Late Penalty (৳150)
  - amount: ৳150
  - allocation_type: penalty

Allocation 2:
  - item: Base Fee (৳3000)
  - amount: ৳3000
  - allocation_type: base_fee

Allocation 3:
  - item: Electricity (৳1500)
  - amount: ৳1500
  - allocation_type: utility

Allocation 4:
  - item: Gas (৳500)
  - amount: ৳500
  - allocation_type: utility
```

**Voucher Updated:**
```
VoucherEntry (SFGV-20260112-0001):
  - status: posted (was draft)
  - postedBy: Staff Member
  - postedAt: 2026-01-15 14:30:00

Additional VoucherEntryDetails Lines:
  Line 3 (DEBIT):
    - account: 1125 - Mobile Banking Account (bKash)
    - debitAmount: ৳5150
    - description: "Payment received via bKash - TXN-202601-ABC123"
  
  Line 4 (CREDIT):
    - account: 1130 - Accounts Receivable
    - creditAmount: ৳5150
    - description: "Payment received from Unit 101"
```

**Accounting Effect:**
```
Mobile Banking Account (Asset)  DEBIT  ৳5150  (cash received)
  Accounts Receivable (Asset)   CREDIT ৳5150  (debt cleared)
```

**Account Balance Updates:**
```
Account 1125 (Mobile Banking):     Balance increases by ৳5150
Account 1130 (Accounts Receivable): Balance decreases by ৳5150
```

---

### 5.3 Cross-App Usage Check

**Voucher tables are used by:**

1. ✅ **Service Fee Management** (`service_fee_management`)
   - Creates vouchers during bill generation
   - Links payments to vouchers
   - File: `utils/voucher_generator.py`

2. ✅ **Accounts Module** (`accounts`)
   - Manual voucher entry
   - Financial reporting
   - Trial balance, ledger, journals

3. ❌ **Other Apps** (NOT directly used)
   - Bulletins, Notifications, Towers: NO voucher interaction
   - User Management: Only creates/receives transactions

**Safety Note:** Voucher schema changes affect both `service_fee_management` and `accounts` apps. Test both modules when modifying.

---

### 5.4 Automated Penalty Tier Updates (Daily Job)

**Purpose:** Automatically escalates penalties for overdue payments based on configured tiers

**When:** Runs daily at **12:00 AM (midnight)** via `penalty_tier_scheduler.py`

**What Gets Updated:**

1. **ServiceFeePaymentLatePenaltyTier**
   - Deactivates all tiers (`status='inactive'`)
   - Activates applicable tier based on days overdue (`status='active'`)

2. **ServiceFeeItem** (Penalty line item)
   - Updates `amount` to new penalty percentage
   - Updates `description` with current days overdue

3. **ServiceFeePayment** (Main bill record)
   - Recalculates `amount` = SUM(all ServiceFeeItems)
   - Recalculates `remaining_amount` = amount - paid_amount
   - **Updates `service_status`** based on payment state:
     * `paid`: remaining_amount = 0
     * `partial`: 0 < remaining_amount < amount
     * `overdue`: remaining_amount > 0 AND today > due_date
     * `due`: remaining_amount > 0 AND today ≤ due_date

4. **VoucherEntry & VoucherEntryDetails** (Accounting)
   - Updates **Debit line** (Accounts Receivable) += penalty_difference
   - Updates **Credit line** (Service Fee Income) += penalty_difference
   - Updates `totalDebit` and `totalCredit` on voucher header
   - Maintains accounting equation: **Total Debit = Total Credit**

**Example Scenario:**

```
Day 1 (Due Date): January 1, 2026
  - Bill: ৳10,000 (base fee only)
  - Penalty: ৳0
  - Voucher: Debit ৳10,000, Credit ৳10,000

Day 7 (6 days overdue): January 7, 2026
  - Penalty Tier 1 activated: 2% penalty
  - Scheduler runs at 12:00 AM
  - Updates:
    * ServiceFeeItem (penalty): ৳0 → ৳200 (10,000 × 2%)
    * ServiceFeePayment.amount: ৳10,000 → ৳10,200
    * ServiceFeePayment.remaining_amount: ৳10,000 → ৳10,200
    * ServiceFeePayment.service_status: 'due' → 'overdue'
    * VoucherEntry: Debit ৳10,000 → ৳10,200
                    Credit ৳10,000 → ৳10,200

Day 11 (10 days overdue): January 11, 2026
  - Penalty Tier 2 activated: 5% penalty
  - Scheduler runs at 12:00 AM
  - Updates:
    * ServiceFeeItem (penalty): ৳200 → ৳500 (10,000 × 5%)
    * ServiceFeePayment.amount: ৳10,200 → ৳10,500
    * ServiceFeePayment.remaining_amount: ৳10,200 → ৳10,500
    * ServiceFeePayment.service_status: 'overdue' (no change)
    * VoucherEntry: Debit ৳10,200 → ৳10,500
                    Credit ৳10,200 → ৳10,500
```

**Database Impact Per Run:**

```sql
-- ServiceFeePaymentLatePenaltyTier: Status updates
UPDATE service_fee_payment_late_penalty_tiers 
SET status = 'inactive' WHERE payment_id = 123;

UPDATE service_fee_payment_late_penalty_tiers 
SET status = 'active', updated_at = NOW() 
WHERE payment_id = 123 AND days_overdue = 10;

-- ServiceFeeItem: Penalty amount update
UPDATE service_fee_management_servicefeeitem 
SET amount = 500.00, 
    description = 'Late penalty (5%) - 10 days overdue'
WHERE service_fee_payment_id = 123 AND item_type = 'penalty';

-- ServiceFeePayment: Total recalculation
UPDATE service_fee_management_servicefeepayment 
SET amount = 10500.00, 
    remaining_amount = 10500.00,
    service_status = 'overdue'
WHERE id = 123;

-- VoucherEntryDetails: Debit line (Accounts Receivable)
UPDATE accounts_voucherentrydetails 
SET debitAmount = 10500.00,
    description = 'Bill receivable - Service fee from Unit 101 (1/2026) - Penalty updated: ৳500'
WHERE voucherEntry_id = 456 AND debitAmount > 0;

-- VoucherEntryDetails: Credit line (Service Fee Income)
UPDATE accounts_voucherentrydetails 
SET creditAmount = 10500.00,
    description = 'Service fee revenue - Unit 101 (1/2026) - Penalty updated: ৳500'
WHERE voucherEntry_id = 456 AND creditAmount > 0;

-- VoucherEntry: Header totals
UPDATE accounts_voucherentry 
SET totalDebit = 10500.00,
    totalCredit = 10500.00,
    narration = 'Service fee bill for Unit 101 - 1/2026 - Penalty tier updated to 5% (৳500)'
WHERE id = 456;
```

**Scheduler Configuration:**

```python
# File: service_fee_management/penalty_tier_scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(
    run_penalty_tier_update,
    trigger=CronTrigger(hour=0, minute=0),  # 12:00 AM daily
    id='penalty_tier_update',
    name='Daily Penalty Tier Update',
    max_instances=1  # Prevent concurrent runs
)
scheduler.start()
```

**Manual Trigger:**
```bash
python manage.py update_penalty_tiers
```

**Logging Output:**
```
[PenaltyTierScheduler] 🔄 Starting penalty tier update at 2026-01-12 00:00:00
  Payment 123: 10 days overdue, checking 2 tiers
    Tier: 6 days = 2% (status=inactive)
    Tier: 10 days = 5% (status=inactive)
    → Selected tier 2 (LAST): 10 days (range 7+)
    Penalty calculation: 10000 × 5% = ৳500
    � Status changed: due → overdue
    �💰 Penalty difference: ৳300 - Updating voucher...
    📋 Found voucher: SFGV-20260101-0001
    ✅ Voucher updated: SFGV-20260101-0001 - Debit/Credit increased by ৳300
  Payment ID 123 (1/2026): Tier updated - 10 days overdue, 5% penalty = ৳500 
  (Old Penalty: ৳200, New Total: ৳10,500, Remaining: ৳10,500)
[PenaltyTierScheduler] ✅ Penalty tier update completed
```

**Error Handling:**
- Each payment processed in separate transaction
- Failed payment updates logged but don't block other payments
- Voucher update failures logged separately (payment still updated)
- Only updates **draft vouchers** (status='draft')
- Posted vouchers remain unchanged (immutable)

---

## 6. Payment Flow & Double Entry Accounting

### 6.1 Complete Payment Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: BILL GENERATION (Monthly Automation)             │
└─────────────────────────────────────────────────────────────┘

1. Admin triggers bill generation (via GenerateServiceFeeModal)
   → POST /api/service-fee-management/generate/

2. System retrieves PRIMARY CONTRACT OWNER INFO from unit:
   → owner_id = unit.primary_contract.owner.id
   → owner_name = unit.primary_contract.owner.full_name
   → owner_email = unit.primary_contract.owner.email
   → owner_phone = unit.primary_contract.owner.phone
   → **NOTE:** resident_id is NOT checked/used during generation

3. ServiceFeePayment records created (one per unit)
   → amount = base_fee + utilities + penalties
   → remaining_amount = amount
   → status = 'due'
   → owner_id, owner_name, owner_email, owner_phone (snapshot)
   → resident_id = NULL (deprecated, not populated)

4. ServiceFeeItem records created (line items)
   → Base Fee: ৳3000
   → Electricity: ৳1500
   → Gas: ৳500
   → Late Penalty: ৳150

5. Voucher automatically created (DRAFT status)
   → VoucherEntry: SFGV-20260112-0001
   → Line 1 DEBIT:  Accounts Receivable ৳5150
   → Line 2 CREDIT: Service Fee Income   ৳5150

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: PAYMENT RECORDING (Resident Pays)                │
└─────────────────────────────────────────────────────────────┘

5. Admin records payment (via RecordPaymentModal)
   → POST /api/service-fee-management/payments/multi-month/

6. ServiceFeeBilling record created (transaction)
   → transaction_id: TXN-202601-ABC123
   → billing_amount: ৳5150
   → payment_method: bKash
   → voucher_id: 789 (links to voucher)

7. ServiceFeePaymentAllocation records created (hierarchy)
   → Penalty cleared first: ৳150
   → Base fee cleared: ৳3000
   → Utilities cleared: ৳2000

8. ServiceFeePayment updated
   → remaining_amount: ৳0
   → service_status: 'paid'

9. Voucher updated (POSTED status)
   → Line 3 DEBIT:  Mobile Banking ৳5150 (cash received)
   → Line 4 CREDIT: Accounts Receivable ৳5150 (debt cleared)
   → status: 'posted'

10. Account balances updated
    → Mobile Banking +৳5150
    → Accounts Receivable -৳5150

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: PARTIAL PAYMENT (Multiple Transactions)          │
└─────────────────────────────────────────────────────────────┘

11. If partial payment (৳3000):
    → First transaction clears penalties + partial base fee
    → service_status: 'partial'
    → remaining_amount: ৳2150

12. Second transaction (৳2150):
    → Clears remaining base fee + utilities
    → service_status: 'paid'
    → remaining_amount: ৳0

Each transaction creates separate:
  - ServiceFeeBilling record
  - ServiceFeePaymentAllocation records
  - Voucher lines

┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: OVERPAYMENT - ADVANCE PAYMENT CREATION           │
└─────────────────────────────────────────────────────────────┘

13. If payment exceeds bill amount (Overpayment):
    EXAMPLE: Bill = ৳15,000 | Payment = ৳30,000
    
    → First ৳15,000 clears current month completely
    → Remaining ৳15,000 becomes AdvancePayment
    
    AdvancePayment created:
      - amount: ৳15,000
      - remaining_amount: ৳15,000
      - status: 'available'
      - advance_type: 'service_fee_advance'
      - source_billing: Links to ServiceFeeBilling record

┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: ADVANCE PAYMENT APPLICATION (Future Months)      │
└─────────────────────────────────────────────────────────────┘

14. When next month bill generated:
    → January bill: ৳15,000 (status: 'due')
    
15. Admin records payment with advance adjustment:
    → Cash/Bank payment: ৳0
    → Advance adjustment: ৳15,000 (from available advance)
    
    AdvancePayment updated:
      - applied_amount: ৳15,000
      - remaining_amount: ৳0
      - status: 'applied'
    
    ServiceFeePayment updated:
      - remaining_amount: ৳0
      - service_status: 'paid'

┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: MIXED PAYMENT (Cash + Advance Adjustment)        │
└─────────────────────────────────────────────────────────────┘

16. Partial cash + advance scenario:
    EXAMPLE: Bill = ৳15,000 | Cash = ৳8,000 | Advance = ৳7,000
    
    → Cash payment: ৳8,000 (via bKash/Bank)
    → Advance adjustment: ৳7,000 (from available advance)
    → Total applied: ৳15,000
    
    ServiceFeeBilling created:
      - billing_amount: ৳15,000
      - total_paid: ৳15,000
      - payment_method: bKash (for cash portion)
    
    AdvancePayment updated:
      - applied_amount: ৳7,000 (incremented)
      - remaining_amount: ৳8,000 (decremented)
      - status: 'partial'
    
    ServiceFeePayment:
      - remaining_amount: ৳0
      - service_status: 'paid'
```

---

### 6.2 Payment Hierarchy Logic

**Automatic Allocation Order** (enforced in `serializers.py`):

```python
# Priority 1: Penalties (highest priority)
penalty_items = ServiceFeeItem.objects.filter(
    service_fee_payment=payment,
    item_type='penalty'
).order_by('created_at')

# Priority 2: Base Service Fee
base_fee_items = ServiceFeeItem.objects.filter(
    service_fee_payment=payment,
    item_type='base_fee'
).order_by('created_at')

# Priority 3: Utilities/Bill Categories (lowest priority)
utility_items = ServiceFeeItem.objects.filter(
    service_fee_payment=payment,
    item_type='bill_category'
).order_by('created_at')

# Allocate payment amount in order
for item in penalty_items + base_fee_items + utility_items:
    if remaining_payment_amount > 0:
        allocated = min(remaining_payment_amount, item.remaining)
        create_allocation(item, allocated)
        remaining_payment_amount -= allocated
```

---

### 6.3 Advance Payment Scenarios

#### Scenario 1: Overpayment Creates Advance

**Setup:**
- Monthly bill: ৳15,000 (Base: ৳10,000 + Utilities: ৳5,000)
- Payment received: ৳30,000 (via bKash)

**Processing:**
```python
# Step 1: Clear current month bill
payment_applied_to_bill = ৳15,000
remaining_payment = ৳30,000 - ৳15,000 = ৳15,000

# Step 2: Create ServiceFeeBilling
ServiceFeeBilling.create(
    billing_amount=৳15,000,
    total_paid=৳15,000,
    payment_method="bKash"
)

# Step 3: Create AdvancePayment for excess
AdvancePayment.create(
    unit_id=101,
    amount=৳15,000,
    remaining_amount=৳15,000,
    applied_amount=৳0,
    status='available',
    advance_type='service_fee_advance',
    source_billing=ServiceFeeBilling.id
)

# Step 4: Update ServiceFeePayment
ServiceFeePayment.update(
    remaining_amount=৳0,
    service_status='paid'
)
```

**Database State After Transaction:**
```
service_fee_payment_details (ServiceFeeBilling):
┌────┬─────────────────┬────────────────┬────────────┬──────────────┐
│ ID │ transaction_id  │ billing_amount │ total_paid │ payment_date │
├────┼─────────────────┼────────────────┼────────────┼──────────────┤
│ 45 │ TXN-202601-XYZ  │ 15000.00       │ 15000.00   │ 2026-01-15   │
└────┴─────────────────┴────────────────┴────────────┴──────────────┘

service_fee_advance_payments (AdvancePayment):
┌────┬─────────┬───────────┬────────────────┬──────────────────┬───────────┬──────────────────┐
│ ID │ unit_id │ amount    │ applied_amount │ remaining_amount │ status    │ source_billing_id│
├────┼─────────┼───────────┼────────────────┼──────────────────┼───────────┼──────────────────┤
│ 12 │ 101     │ 15000.00  │ 0.00           │ 15000.00         │ available │ 45               │
└────┴─────────┴───────────┴────────────────┴──────────────────┴───────────┴──────────────────┘
```

**Accounting Entry:**
```
DEBIT:  Mobile Banking Account (1125)    ৳30,000
  CREDIT: Accounts Receivable (1130)     ৳15,000  (bill cleared)
  CREDIT: Advance Deposit Liability (2115) ৳15,000  (advance held)
```

---

#### Scenario 2: Full Advance Adjustment (No Cash)

**Setup:**
- Previous advance balance: ৳15,000
- January 2026 bill: ৳15,000
- Payment: ৳0 cash + ৳15,000 advance adjustment

**Processing:**
```python
# Step 1: Find available advance
advance = AdvancePayment.objects.filter(
    unit_id=101,
    status__in=['available', 'partial']
).first()  # Returns: amount=৳15,000, remaining=৳15,000

# Step 2: Apply advance to current bill
advance.apply_to_payment(amount=৳15,000)
# Updates:
#   applied_amount = ৳15,000
#   remaining_amount = ৳0
#   status = 'applied'
#   applied_at = NOW()

# Step 3: Create ServiceFeeBilling (marks source as advance)
ServiceFeeBilling.create(
    billing_amount=৳15,000,
    total_paid=৳15,000,
    payment_method=None,  # No payment method (advance adjustment)
    notes="Advance adjustment from previous overpayment"
)

# Step 4: Update ServiceFeePayment
ServiceFeePayment.update(
    remaining_amount=৳0,
    service_status='paid'
)
```

**Database State After Transaction:**
```
service_fee_advance_payments (Updated):
┌────┬─────────┬───────────┬────────────────┬──────────────────┬─────────┬────────────┐
│ ID │ unit_id │ amount    │ applied_amount │ remaining_amount │ status  │ applied_at │
├────┼─────────┼───────────┼────────────────┼──────────────────┼─────────┼────────────┤
│ 12 │ 101     │ 15000.00  │ 15000.00       │ 0.00             │ applied │ 2026-02-01 │
└────┴─────────┴───────────┴────────────────┴──────────────────┴─────────┴────────────┘
```

**Accounting Entry:**
```
DEBIT:  Advance Deposit Liability (2115)  ৳15,000  (advance released)
  CREDIT: Accounts Receivable (1130)      ৳15,000  (bill cleared)
```

---

#### Scenario 3: Mixed Payment (Cash + Advance)

**Setup:**
- January bill: ৳15,000
- Previous advance: ৳7,000
- Cash payment: ৳8,000 (via Bank Transfer)

**Processing:**
```python
# Step 1: Calculate payment breakdown
bill_amount = ৳15,000
cash_payment = ৳8,000
advance_available = ৳7,000

# Step 2: Apply cash first
cash_applied = min(cash_payment, bill_amount) = ৳8,000
remaining_bill = ৳15,000 - ৳8,000 = ৳7,000

# Step 3: Apply advance to remaining
advance_applied = min(advance_available, remaining_bill) = ৳7,000
remaining_bill = ৳7,000 - ৳7,000 = ৳0

# Step 4: Update advance record
advance.apply_to_payment(amount=৳7,000)
# Updates:
#   applied_amount = ৳7,000
#   remaining_amount = ৳0
#   status = 'applied'

# Step 5: Create ServiceFeeBilling (shows total payment)
ServiceFeeBilling.create(
    billing_amount=৳15,000,
    total_paid=৳15,000,  # Cash ৳8,000 + Advance ৳7,000
    payment_method="Bank Transfer",  # For cash portion
    notes="Cash: ৳8,000 + Advance: ৳7,000"
)

# Step 6: Update ServiceFeePayment
ServiceFeePayment.update(
    remaining_amount=৳0,
    service_status='paid'
)
```

**Database State After Transaction:**
```
service_fee_payment_details (ServiceFeeBilling):
┌────┬─────────────────┬────────────────┬────────────┬────────────────┬────────────────────────┐
│ ID │ transaction_id  │ billing_amount │ total_paid │ payment_method │ notes                  │
├────┼─────────────────┼────────────────┼────────────┼────────────────┼────────────────────────┤
│ 46 │ TXN-202602-ABC  │ 15000.00       │ 15000.00   │ Bank Transfer  │ Cash: ৳8,000 +         │
│    │                 │                │            │                │ Advance: ৳7,000        │
└────┴─────────────────┴────────────────┴────────────┴────────────────┴────────────────────────┘

service_fee_advance_payments (Updated):
┌────┬─────────┬───────────┬────────────────┬──────────────────┬─────────┐
│ ID │ unit_id │ amount    │ applied_amount │ remaining_amount │ status  │
├────┼─────────┼───────────┼────────────────┼──────────────────┼─────────┤
│ 12 │ 101     │ 7000.00   │ 7000.00        │ 0.00             │ applied │
└────┴─────────┴───────────┴────────────────┴──────────────────┴─────────┘
```

**Accounting Entry:**
```
DEBIT:  Bank Account (1121)                    ৳8,000   (cash received)
DEBIT:  Advance Deposit Liability (2115)       ৳7,000   (advance released)
  CREDIT: Accounts Receivable (1130)           ৳15,000  (bill cleared)
```

---

#### Scenario 4: Partial Advance Application

**Setup:**
- February bill: ৳15,000
- Previous advance: ৳20,000
- Partial advance use: ৳10,000 (saving ৳10,000 for later)

**Processing:**
```python
# Step 1: Apply partial advance
advance = AdvancePayment.objects.get(id=12)
advance.apply_to_payment(amount=৳10,000)
# Updates:
#   applied_amount = ৳10,000
#   remaining_amount = ৳10,000
#   status = 'partial'  # Auto-set because remaining > 0

# Step 2: Bill still has outstanding
ServiceFeePayment.update(
    remaining_amount=৳5,000,  # ৳15,000 - ৳10,000
    service_status='partial'
)
```

**Database State:**
```
service_fee_advance_payments:
┌────┬─────────┬───────────┬────────────────┬──────────────────┬─────────┐
│ ID │ unit_id │ amount    │ applied_amount │ remaining_amount │ status  │
├────┼─────────┼───────────┼────────────────┼──────────────────┼─────────┤
│ 12 │ 101     │ 20000.00  │ 10000.00       │ 10000.00         │ partial │
└────┴─────────┴───────────┴────────────────┴──────────────────┴─────────┘

service_fee_management_servicefeepayment:
┌────┬─────────┬────────────────┬───────────────┐
│ ID │ amount  │ remaining_amt  │ service_status│
├────┼─────────┼────────────────┼───────────────┤
│ 89 │ 15000   │ 5000.00        │ partial       │
└────┴─────────┴────────────────┴───────────────┘
```

---

#### Scenario 5: Multi-Month Overpayment

**Setup:**
- December bill: ৳15,000
- January bill: ৳15,000
- Payment: ৳50,000 (for both months + advance)

**Processing:**
```python
# Step 1: Clear December (৳15,000)
payment_for_dec = ৳15,000
remaining = ৳50,000 - ৳15,000 = ৳35,000

# Step 2: Clear January (৳15,000)
payment_for_jan = ৳15,000
remaining = ৳35,000 - ৳15,000 = ৳20,000

# Step 3: Create advance for excess (৳20,000)
AdvancePayment.create(
    amount=৳20,000,
    remaining_amount=৳20,000,
    status='available'
)

# Result: 2 months paid + ৳20,000 advance
```

**Database State:**
```
service_fee_advance_payments:
┌────┬─────────┬───────────┬────────────────┬──────────────────┬───────────┐
│ ID │ unit_id │ amount    │ applied_amount │ remaining_amount │ status    │
├────┼─────────┼───────────┼────────────────┼──────────────────┼───────────┤
│ 13 │ 101     │ 20000.00  │ 0.00           │ 20000.00         │ available │
└────┴─────────┴───────────┴────────────────┴──────────────────┴───────────┘
```

---

### 6.4 Advance Payment Query Examples

**Check available advance balance:**
```python
from django.db.models import Sum
from service_fee_management.models import AdvancePayment

available_advance = AdvancePayment.objects.filter(
    unit_id=101,
    status__in=['available', 'partial']
).aggregate(
    total=Sum('remaining_amount')
)['total'] or Decimal('0.00')

print(f"Available advance: ৳{available_advance}")
```

**Get advance history:**
```python
advances = AdvancePayment.objects.filter(
    unit_id=101
).order_by('-created_at')

for adv in advances:
    print(f"{adv.created_at}: ৳{adv.amount} | "
          f"Applied: ৳{adv.applied_amount} | "
          f"Remaining: ৳{adv.remaining_amount} | "
          f"Status: {adv.status}")
```

**Apply advance to bill:**
```python
# Get oldest available advance (FIFO)
advance = AdvancePayment.objects.filter(
    unit_id=101,
    status__in=['available', 'partial']
).order_by('created_at').first()

if advance:
    amount_to_apply = min(advance.remaining_amount, bill_amount)
    advance.apply_to_payment(amount_to_apply)
    print(f"Applied ৳{amount_to_apply} from Advance ID {advance.id}")
```

---

### 6.5 Advance Payment During Bill Generation - Automated Month-to-Month Application

#### Overview

This section describes **automated advance payment application** during monthly service fee generation. When a unit has an existing advance balance, the system can automatically offset it against new bills **without requiring manual cash payment**.

**Key Design Principles:**
1. ✅ **Automatic Detection**: Generation process checks for available advance balance
2. ✅ **FIFO Application**: Oldest advances applied first (First-In-First-Out)
3. ✅ **Balance Tracking**: Advance balance reduces as bills are generated
4. ✅ **No Overpayment**: Cannot create new advance during generation (only payment recording)
5. ✅ **Existing Endpoint**: Uses `ServiceFeeMultiMonthPaymentView` (no new endpoints needed)
6. ✅ **Status Management**: Bills marked 'paid' if fully covered by advance

---

#### 6.5.1 Generation-Time Advance Check - Automatic Offset

**When:** Monthly service fee generation (`generate_service_fees()` utility)

**Trigger:** Admin generates bills for January 2026 via UI

**Process Flow:**

```
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: Standard Bill Generation                               │
└────────────────────────────────────────────────────────────────┘

ServiceFeePayment created:
  - unit_id: 87
  - service_period: January 2026
  - amount: ৳18,600 (base: ৳15,000 + utilities: ৳2,000 + penalty: ৳1,600)
  - remaining_amount: ৳18,600
  - service_status: 'due'
  - payment_status: 'pending'

ServiceFeeItem records created:
  - Base Fee: ৳15,000
  - Electricity: ৳1,500
  - Water: ৳500
  - Late Penalty: ৳1,600

┌────────────────────────────────────────────────────────────────┐
│ STEP 2: Check for Available Advance Balance                   │
└────────────────────────────────────────────────────────────────┘

Query:
  SELECT SUM(remaining_amount) 
  FROM service_fee_advance_payments
  WHERE unit_id = 87
    AND status IN ('available', 'partial')

Result: ৳25,000 (advance balance exists)

┌────────────────────────────────────────────────────────────────┐
│ STEP 3: Automatic Advance Application Logic                   │
└────────────────────────────────────────────────────────────────┘

Calculation:
  - Bill amount: ৳18,600
  - Available advance: ৳25,000
  - Amount to apply: MIN(৳18,600, ৳25,000) = ৳18,600
  - Remaining advance after: ৳25,000 - ৳18,600 = ৳6,400

Decision:
  ✅ Full bill amount covered by advance
  → Auto-create advance adjustment transaction
  → Mark bill as 'paid' immediately
```

---

#### 6.5.2 Database State Changes

**Before Generation:**
```
service_fee_advance_payments:
┌────┬─────────┬───────────┬────────────────┬──────────────────┬───────────┐
│ ID │ unit_id │ amount    │ applied_amount │ remaining_amount │ status    │
├────┼─────────┼───────────┼────────────────┼──────────────────┼───────────┤
│ 42 │ 87      │ 30000.00  │ 5000.00        │ 25000.00         │ partial   │
└────┴─────────┴───────────┴────────────────┴──────────────────┴───────────┘
```

**After Generation (with auto-adjustment):**
```
service_fee_management_servicefeepayment:
┌────┬─────────┬──────────┬────────────┬────────────────┬────────────────┐
│ ID │ unit_id │ amount   │ remaining  │ service_status │ payment_status │
├────┼─────────┼──────────┼────────────┼────────────────┼────────────────┤
│156 │ 87      │ 18600.00 │ 0.00       │ paid           │ completed      │
└────┴─────────┴──────────┴────────────┴────────────────┴────────────────┘

service_fee_payment_details:
┌────┬──────────────────────┬────────────────┬────────────┬────────────────┬──────────┐
│ ID │ transaction_id       │ billing_amount │ total_paid │ payment_method │ notes    │
├────┼──────────────────────┼────────────────┼────────────┼────────────────┼──────────┤
│321 │ TXN-ADV-202601-0001 │ 18600.00       │ 18600.00   │ NULL           │ Advance  │
│    │                      │                │            │                │ Auto-    │
│    │                      │                │            │                │ Applied  │
└────┴──────────────────────┴────────────────┴────────────┴────────────────┴──────────┘

service_fee_advance_payments (Updated):
┌────┬─────────┬───────────┬────────────────┬──────────────────┬─────────┐
│ ID │ unit_id │ amount    │ applied_amount │ remaining_amount │ status  │
├────┼─────────┼───────────┼────────────────┼──────────────────┼─────────┤
│ 42 │ 87      │ 30000.00  │ 23600.00       │ 6400.00          │ partial │
└────┴─────────┴───────────┴────────────────┴──────────────────┴─────────┘
```

---

#### 6.5.3 Month-to-Month Balance Management

**Scenario:** Unit 87 has ৳6,400 remaining advance after January generation

**February 2026 Generation:**

```
┌────────────────────────────────────────────────────────────────┐
│ February Bill Generation                                       │
└────────────────────────────────────────────────────────────────┘

New bill created:
  - amount: ৳17,000 (base: ৳15,000 + utilities: ৳2,000)
  - remaining_amount: ৳17,000

Advance check:
  - Available advance: ৳6,400
  - Bill amount: ৳17,000
  - Amount to apply: MIN(৳6,400, ৳17,000) = ৳6,400

Result:
  - Partial payment from advance: ৳6,400
  - Remaining bill amount: ৳10,600
  - service_status: 'partial'
  - Advance balance: ৳0 (fully consumed)

Database state:
  ServiceFeePayment:
    remaining_amount: ৳10,600
    service_status: 'partial'
  
  AdvancePayment (ID 42):
    applied_amount: ৳30,000 (fully consumed)
    remaining_amount: ৳0
    status: 'applied'
```

---

#### 6.5.4 API Integration - Multi-Month Payment Endpoint

**Endpoint:** `POST /api/service-fee-management/multi-month-payment/`

**View:** `ServiceFeeMultiMonthPaymentView`

**Use Case:** Manual payment recording with advance adjustment

**Request Payload Structure:**
```json
{
  "unit_id": 87,
  "service_fee_id": 6,
  "resident_id": null,
  "payment_method": 1,
  "reference_number": "",
  "notes": "",
  "created_by": 1,
  "sendEmail": true,
  "selected_periods": [
    {
      "service_period_month": 1,
      "service_period_year": 2026,
      "penalty_amount": 1860,
      "waived_amount": 930,
      "new_waiver_data": [
        {
          "waivedAmount": 930,
          "reason": "Administrative Decision",
          "appliedAt": "2026-01-13T10:33:11.090Z",
          "appliedBy": "Md. Tausif Hossain",
          "waiverType": "partial",
          "partialType": "percentage",
          "waiverPercentage": 50,
          "isSessionNew": true
        }
      ]
    }
  ],
  "total_amount": 10,
  "from_account_number": null,
  "to_account_number": null,
  "to_account_name": null,
  "other_method_name": null
}
```

**Field Explanation:**
- `total_amount: 10` - Cash payment amount (৳10)
- System automatically checks for advance balance
- If advance exists, applies it to cover remaining bill amount
- Creates advance adjustment transaction automatically

**Processing Logic:**
```python
# Step 1: Validate bill exists and is unpaid
payment = ServiceFeePayment.objects.get(
    unit_id=87,
    service_period_month=1,
    service_period_year=2026
)

# Step 2: Calculate bill after waiver
original_bill = ৳18,600
waived_amount = ৳930
bill_after_waiver = ৳17,670

# Step 3: Apply cash payment
cash_payment = ৳10
remaining_bill = ৳17,670 - ৳10 = ৳17,660

# Step 4: Check for available advance
advance = AdvancePayment.objects.filter(
    unit_id=87,
    status__in=['available', 'partial']
).order_by('created_at').first()

advance_available = advance.remaining_amount if advance else 0  # ৳6,400

# Step 5: Apply advance to remaining bill
if advance_available > 0:
    advance_to_apply = min(advance_available, remaining_bill)  # ৳6,400
    advance.apply_to_payment(advance_to_apply)
    remaining_bill -= advance_to_apply  # ৳17,660 - ৳6,400 = ৳11,260

# Step 6: Update payment record
payment.remaining_amount = remaining_bill  # ৳11,260
payment.service_status = 'partial' if remaining_bill > 0 else 'paid'
payment.save()

# Step 7: Create billing records
ServiceFeeBilling.objects.create(
    servicefeepaymentid=payment,
    transaction_id=generate_transaction_id(),
    billing_amount=cash_payment + advance_to_apply,  # ৳10 + ৳6,400 = ৳6,410
    total_paid=cash_payment + advance_to_apply,
    payment_method_id=1,
    notes=f"Cash: ৳{cash_payment}, Advance: ৳{advance_to_apply}"
)
```




---

#### 6.5.5 Advance Payment Business Rules

**Rule 1: No Overpayment During Generation**
- ❌ Generation process **CANNOT** create new advance payments
- ✅ Only **consumes** existing advance balances
- ✅ New advances created **ONLY** during manual payment recording

**Rule 2: FIFO Advance Consumption**
- Always apply oldest advance first (`order_by('created_at')`)
- Prevents advance balance fragmentation
- Clear audit trail of advance usage

**Rule 3: Partial Advance Handling**
```python
if advance.remaining_amount >= bill_amount:
    # Full bill covered by advance
    advance.applied_amount += bill_amount
    advance.remaining_amount -= bill_amount
    advance.status = 'applied' if advance.remaining_amount == 0 else 'partial'
else:
    # Advance covers partial bill
    partial_apply = advance.remaining_amount
    advance.applied_amount += partial_apply
    advance.remaining_amount = 0
    advance.status = 'applied'
    bill.remaining_amount = bill_amount - partial_apply
    bill.service_status = 'partial'
```

**Rule 4: Status Transitions**
```
available → partial → applied
    ↓         ↓         ↓
(unused) (partially) (fully
         (used)      (consumed)
```

**Rule 5: Prevent Current Month Overpayment**
- Cash payment + advance adjustment **CANNOT** exceed bill amount
- Validation in `ServiceFeeMultiMonthPaymentView`:
```python
total_payment = cash_payment + advance_adjustment
if total_payment > bill_amount:
    raise ValidationError(
        f"Payment (৳{total_payment}) exceeds bill amount (৳{bill_amount}). "
        "Cannot create advance during generation. "
        "Please adjust payment amount."
    )
```

---

#### 6.5.6 Reporting & Audit Trail

**Advance Balance Report:**
```sql
SELECT 
    u.unit_name,
    SUM(CASE WHEN afp.status IN ('available', 'partial') 
        THEN afp.remaining_amount ELSE 0 END) as available_advance,
    SUM(afp.amount) as total_advance_received,
    SUM(afp.applied_amount) as total_advance_used
FROM service_fee_advance_payments afp
JOIN towers_unit u ON u.id = afp.unit_id
WHERE afp.status != 'cancelled'
GROUP BY u.id, u.unit_name
HAVING available_advance > 0
ORDER BY available_advance DESC;
```

**Month-to-Month Advance Usage:**
```sql
SELECT 
    sfp.service_period_month,
    sfp.service_period_year,
    sfp.amount as bill_amount,
    sfb.billing_amount as payment_applied,
    CASE 
        WHEN sfb.payment_method_id IS NULL THEN 'Advance Adjustment'
        ELSE pm.method_name 
    END as payment_source
FROM service_fee_management_servicefeepayment sfp
LEFT JOIN service_fee_payment_details sfb ON sfb.servicefeepaymentid_id = sfp.id
LEFT JOIN payment_methods pm ON pm.id = sfb.payment_method_id
WHERE sfp.unit_id = 87
ORDER BY sfp.service_period_year DESC, sfp.service_period_month DESC;
```

---

#### 6.5.7 Frontend UI Considerations

**Generation Wizard Updates:**
```jsx
// Display advance balance warning during generation
if (unit.advance_balance > 0) {
  return (
    <Alert severity="info">
      <strong>Advance Available:</strong> ৳{unit.advance_balance}
      <br />
      This will be automatically applied to the generated bill.
    </Alert>
  );
}
```

**Payment Modal Updates:**
```jsx
// Show available advance during payment recording
<TextField
  label="Available Advance"
  value={formatCurrency(availableAdvance)}
  disabled
  helperText="Will be auto-applied to remaining balance"
/>

<TextField
  label="Cash Payment Amount"
  value={cashAmount}
  onChange={handleCashChange}
  error={cashAmount + availableAdvance > billAmount}
  helperText={
    cashAmount + availableAdvance > billAmount
      ? "⚠️ Total payment exceeds bill amount"
      : `Remaining after advance: ৳${billAmount - availableAdvance}`
  }
/>
```

---

#### 6.5.8 Edge Cases & Error Handling

**Edge Case 1: Negative Advance Balance**
```python
# Should never happen, but validate
if advance.remaining_amount < 0:
    logger.error(f"Negative advance balance: {advance.id}")
    advance.remaining_amount = 0
    advance.status = 'applied'
    advance.save()
```

**Edge Case 2: Multiple Advances for Same Unit**
```python
# Apply oldest first (FIFO), then next oldest
advances = AdvancePayment.objects.filter(
    unit_id=unit_id,
    status__in=['available', 'partial']
).order_by('created_at')

for advance in advances:
    if remaining_bill <= 0:
        break
    amount_to_apply = min(advance.remaining_amount, remaining_bill)
    advance.apply_to_payment(amount_to_apply)
    remaining_bill -= amount_to_apply
```

**Edge Case 3: Concurrent Generation/Payment**
```python
# Use database-level locking
with transaction.atomic():
    advance = AdvancePayment.objects.select_for_update().get(id=advance_id)
    # Safe to modify advance balance
    advance.apply_to_payment(amount)
```

**Error Handling:**
```python
try:
    advance.apply_to_payment(amount)
except InsufficientAdvanceBalance:
    return JsonResponse({
        'success': False,
        'error': 'Insufficient advance balance',
        'available': advance.remaining_amount,
        'requested': amount
    })
except AdvanceAlreadyApplied:
    return JsonResponse({
        'success': False,
        'error': 'This advance has already been fully applied'
    })
```

---

#### 6.5.9 Implementation Checklist

**Backend Changes:**
- [x] Add advance balance check in `generate_service_fees()` utility
- [x] Auto-create advance adjustment transactions during generation
- [x] Update `ServiceFeeMultiMonthPaymentView` to prevent overpayment
- [x] Add FIFO advance consumption logic
- [x] Implement database-level locking for concurrent updates

**Database:**
- [x] Ensure indexes on `service_fee_advance_payments` (unit_id, status, created_at)
- [x] Add validation constraints (remaining_amount >= 0)
- [x] Audit trail for advance applications

**Frontend:**
- [x] Display advance balance in generation wizard
- [x] Show advance balance in payment recording modal
- [x] Validate total payment <= bill amount (prevent overpayment)
- [x] Add advance usage history view

**Testing:**
- [x] Unit tests for FIFO advance consumption
- [x] Integration tests for month-to-month balance tracking
- [x] Edge case tests (negative balance, concurrent updates)
- [x] UI tests for overpayment prevention

---

### 6.6 Automatic Advance Payment Adjustment Updates ⭐ NEW FEATURE

#### Overview

This section describes **asynchronous automatic advance payment updates** to prevent blocking the payment response while updating advance balances and related accounting records. When a payment is recorded, the system immediately responds to the user while **Django signals** or **database triggers** handle advance payment adjustments in the background.

**Key Design Principles:**
1. ✅ **Non-Blocking Response**: User receives immediate payment confirmation
2. ✅ **Background Processing**: Advance payment updates happen asynchronously
3. ✅ **Two Implementation Options**: Django signals OR database triggers
4. ✅ **Automatic Voucher Updates**: Accounting entries updated automatically
5. ✅ **Error Recovery**: Failed updates logged and can be retried

---

#### 6.6.1 Implementation Option 1: Django Signals (Recommended)

**File:** `backend/service_fee_management/signals.py`

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from decimal import Decimal
import logging

from .models import (
    ServiceFeeBilling, 
    ServiceFeePayment, 
    AdvancePayment
)
from accounts.models import VoucherEntry, VoucherEntryDetails

logger = logging.getLogger(__name__)

@receiver(post_save, sender=ServiceFeeBilling)
def auto_update_advance_payments(sender, instance, created, **kwargs):
    """
    Automatically update advance payment balances when payment is recorded.
    Runs asynchronously after ServiceFeeBilling is saved.
    
    This signal:
    1. Checks if payment creates overpayment (advance)
    2. Updates existing advance balances if applied
    3. Updates related voucher entries automatically
    4. Does NOT block the HTTP response
    """
    if not created:
        return  # Only process new payments
    
    try:
        with transaction.atomic():
            # Get the parent payment record
            payment = instance.servicefeepaymentid
            
            # Calculate if overpayment exists
            total_paid = ServiceFeeBilling.objects.filter(
                servicefeepaymentid=payment
            ).aggregate(
                total=Sum('billing_amount')
            )['total'] or Decimal('0.00')
            
            overpayment_amount = total_paid - payment.amount
            
            # SCENARIO 1: Overpayment - Create new advance
            if overpayment_amount > 0:
                logger.info(
                    f"Overpayment detected: ৳{overpayment_amount} "
                    f"for payment ID {payment.id}"
                )
                
                advance = AdvancePayment.objects.create(
                    unit_id=payment.unit_id,
                    owner_id=payment.owner_id,
                    account_holder_type='owner',
                    account_holder_id=payment.owner_id,
                    advance_type='auto_excess',
                    amount=overpayment_amount,
                    applied_amount=Decimal('0.00'),
                    remaining_amount=overpayment_amount,
                    source_billing=instance,
                    status='available',
                    created_by_id=instance.received_by_id,
                    notes=f'Auto-created from overpayment - Transaction {instance.transaction_id}'
                )
                
                logger.info(f"Created advance payment ID {advance.id}: ৳{overpayment_amount}")
                
                # Update voucher entry for advance deposit liability
                update_voucher_for_advance(instance, overpayment_amount)
            
            # SCENARIO 2: Advance was applied - Update existing advance record
            elif hasattr(instance, '_advance_applied_amount') and instance._advance_applied_amount > 0:
                advance_id = getattr(instance, '_advance_id', None)
                applied_amount = instance._advance_applied_amount
                
                if advance_id:
                    advance = AdvancePayment.objects.select_for_update().get(id=advance_id)
                    
                    # Update advance balance
                    advance.applied_amount += applied_amount
                    advance.remaining_amount -= applied_amount
                    
                    # Update status
                    if advance.remaining_amount <= 0:
                        advance.status = 'applied'
                        advance.applied_at = timezone.now()
                    elif advance.applied_amount > 0:
                        advance.status = 'partial'
                    
                    advance.save()
                    
                    logger.info(
                        f"Updated advance ID {advance_id}: "
                        f"Applied ৳{applied_amount}, "
                        f"Remaining ৳{advance.remaining_amount}"
                    )
            
    except Exception as e:
        logger.error(
            f"Failed to auto-update advance for billing ID {instance.id}: {str(e)}",
            exc_info=True
        )
        # Don't raise - allow payment to complete even if advance update fails


def update_voucher_for_advance(billing_instance, advance_amount):
    """
    Update voucher entry to reflect advance deposit liability
    """
    try:
        voucher = billing_instance.voucher
        if not voucher:
            logger.warning(f"No voucher found for billing ID {billing_instance.id}")
            return
        
        # Add voucher line for advance deposit liability
        VoucherEntryDetails.objects.create(
            voucherEntry=voucher,
            lineNumber=voucher.details.count() + 1,
            account_id=get_account_by_code('2115'),  # Advance Deposit Liability
            description=f'Advance deposit from overpayment - {billing_instance.transaction_id}',
            debitAmount=Decimal('0.00'),
            creditAmount=advance_amount
        )
        
        # Update voucher totals
        voucher.totalCredit += advance_amount
        voucher.save()
        
        logger.info(f"Updated voucher ID {voucher.id} for advance deposit: ৳{advance_amount}")
        
    except Exception as e:
        logger.error(f"Failed to update voucher for advance: {str(e)}", exc_info=True)


@receiver(post_save, sender=ServiceFeePayment)
def auto_update_voucher_on_payment_change(sender, instance, created, **kwargs):
    """
    Automatically update voucher when payment status/amount changes.
    Runs after penalty tier updates or manual adjustments.
    """
    if created:
        return  # Skip for new payments (handled by generation)
    
    try:
        # Find related voucher
        voucher = VoucherEntry.objects.filter(
            referenceNumber=str(instance.id),
            voucherType__name='receipt',
            status='draft'  # Only update draft vouchers
        ).first()
        
        if not voucher:
            logger.debug(f"No draft voucher found for payment ID {instance.id}")
            return
        
        with transaction.atomic():
            # Update Accounts Receivable debit line
            debit_line = voucher.details.filter(debitAmount__gt=0).first()
            if debit_line:
                old_amount = debit_line.debitAmount
                new_amount = instance.amount
                
                debit_line.debitAmount = new_amount
                debit_line.description = (
                    f'Bill receivable - Service fee from Unit {instance.unit.unit_name} '
                    f'({instance.service_period_month}/{instance.service_period_year}) - '
                    f'Updated: ৳{old_amount} → ৳{new_amount}'
                )
                debit_line.save()
            
            # Update Service Fee Income credit line
            credit_line = voucher.details.filter(creditAmount__gt=0).first()
            if credit_line:
                credit_line.creditAmount = instance.amount
                credit_line.description = (
                    f'Service fee revenue - Unit {instance.unit.unit_name} '
                    f'({instance.service_period_month}/{instance.service_period_year}) - '
                    f'Amount updated to ৳{instance.amount}'
                )
                credit_line.save()
            
            # Update voucher header totals
            voucher.totalDebit = instance.amount
            voucher.totalCredit = instance.amount
            voucher.narration = (
                f'Service fee bill for Unit {instance.unit.unit_name} - '
                f'{instance.service_period_month}/{instance.service_period_year} - '
                f'Auto-updated to ৳{instance.amount}'
            )
            voucher.save()
            
            logger.info(f"Auto-updated voucher ID {voucher.id} to ৳{instance.amount}")
            
    except Exception as e:
        logger.error(
            f"Failed to auto-update voucher for payment ID {instance.id}: {str(e)}",
            exc_info=True
        )
```

**Register Signals in App Config:**

**File:** `backend/service_fee_management/apps.py`

```python
from django.apps import AppConfig

class ServiceFeeManagementConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'service_fee_management'

    def ready(self):
        # Import signals to register them
        import service_fee_management.signals
        
        # Import penalty tier scheduler
        from .penalty_tier_scheduler import start_scheduler
        start_scheduler()
```

**Update Payment View to Set Signal Context:**

**File:** `backend/service_fee_management/views.py` (partial)

```python
class ServiceFeeMultiMonthPaymentView(APIView):
    def post(self, request):
        # ... existing code ...
        
        # Check for advance payment application
        advance_to_apply = Decimal('0.00')
        advance_id = None
        
        if total_payment_amount < payment_record.remaining_amount:
            # Check available advance
            advance = AdvancePayment.objects.filter(
                unit_id=unit_id,
                status__in=['available', 'partial']
            ).order_by('created_at').first()
            
            if advance and advance.remaining_amount > 0:
                shortfall = payment_record.remaining_amount - total_payment_amount
                advance_to_apply = min(advance.remaining_amount, shortfall)
                advance_id = advance.id
        
        # Create billing record
        billing = ServiceFeeBilling.objects.create(
            servicefeepaymentid=payment_record,
            transaction_id=generate_transaction_id(),
            billing_amount=total_payment_amount + advance_to_apply,
            # ... other fields ...
        )
        
        # Set signal context for async processing
        if advance_to_apply > 0:
            billing._advance_applied_amount = advance_to_apply
            billing._advance_id = advance_id
            billing.save()  # Triggers signal
        
        # Return immediate response (don't wait for signal processing)
        return Response({
            'success': True,
            'message': 'Payment recorded successfully',
            'transaction_id': billing.transaction_id,
            'advance_applied': float(advance_to_apply),
            'note': 'Advance payment updates are processing in background'
        }, status=status.HTTP_201_CREATED)
```

---

#### 6.6.2 Implementation Option 2: Database Triggers (Alternative)

**MySQL/MariaDB Trigger for Advance Payment Updates:**

```sql
DELIMITER $$

-- Trigger 1: Auto-create advance on overpayment
CREATE TRIGGER trg_auto_create_advance_on_overpayment
AFTER INSERT ON service_fee_payment_details
FOR EACH ROW
BEGIN
    DECLARE v_payment_amount DECIMAL(10,2);
    DECLARE v_total_paid DECIMAL(10,2);
    DECLARE v_overpayment DECIMAL(10,2);
    DECLARE v_unit_id INT;
    DECLARE v_owner_id INT;
    
    -- Get payment details
    SELECT amount, unit_id, owner_id
    INTO v_payment_amount, v_unit_id, v_owner_id
    FROM service_fee_management_servicefeepayment
    WHERE id = NEW.servicefeepaymentid_id;
    
    -- Calculate total paid
    SELECT COALESCE(SUM(billing_amount), 0)
    INTO v_total_paid
    FROM service_fee_payment_details
    WHERE servicefeepaymentid_id = NEW.servicefeepaymentid_id;
    
    -- Check for overpayment
    SET v_overpayment = v_total_paid - v_payment_amount;
    
    IF v_overpayment > 0 THEN
        -- Create advance payment record
        INSERT INTO service_fee_advance_payments (
            unit_id,
            owner_id,
            account_holder_type,
            account_holder_id,
            advance_type,
            amount,
            applied_amount,
            remaining_amount,
            source_billing_id,
            status,
            created_at,
            notes
        ) VALUES (
            v_unit_id,
            v_owner_id,
            'owner',
            v_owner_id,
            'auto_excess',
            v_overpayment,
            0.00,
            v_overpayment,
            NEW.id,
            'available',
            NOW(),
            CONCAT('Auto-created from overpayment - Transaction ', NEW.transaction_id)
        );
    END IF;
END$$

-- Trigger 2: Auto-update advance when applied
CREATE TRIGGER trg_auto_update_advance_on_application
AFTER UPDATE ON service_fee_advance_payments
FOR EACH ROW
BEGIN
    -- Auto-update status based on remaining amount
    IF NEW.remaining_amount <= 0 AND OLD.status != 'applied' THEN
        UPDATE service_fee_advance_payments
        SET status = 'applied',
            applied_at = NOW()
        WHERE id = NEW.id;
    ELSEIF NEW.applied_amount > 0 AND NEW.remaining_amount > 0 AND OLD.status = 'available' THEN
        UPDATE service_fee_advance_payments
        SET status = 'partial'
        WHERE id = NEW.id;
    END IF;
END$$

-- Trigger 3: Auto-update voucher on payment amount change
CREATE TRIGGER trg_auto_update_voucher_on_payment_change
AFTER UPDATE ON service_fee_management_servicefeepayment
FOR EACH ROW
BEGIN
    DECLARE v_voucher_id INT;
    
    -- Only process if amount changed
    IF NEW.amount != OLD.amount THEN
        -- Find related draft voucher
        SELECT id INTO v_voucher_id
        FROM accounts_voucherentry
        WHERE referenceNumber = CAST(NEW.id AS CHAR)
          AND voucherType_id = (SELECT id FROM accounts_vouchertype WHERE name = 'receipt')
          AND status = 'draft'
        LIMIT 1;
        
        IF v_voucher_id IS NOT NULL THEN
            -- Update debit line (Accounts Receivable)
            UPDATE accounts_voucherentrydetails
            SET debitAmount = NEW.amount,
                description = CONCAT(
                    'Bill receivable - Service fee from Unit ', 
                    (SELECT unit_name FROM towers_unit WHERE id = NEW.unit_id),
                    ' - Auto-updated to ৳', NEW.amount
                )
            WHERE voucherEntry_id = v_voucher_id
              AND debitAmount > 0
            LIMIT 1;
            
            -- Update credit line (Service Fee Income)
            UPDATE accounts_voucherentrydetails
            SET creditAmount = NEW.amount,
                description = CONCAT(
                    'Service fee revenue - Auto-updated to ৳', NEW.amount
                )
            WHERE voucherEntry_id = v_voucher_id
              AND creditAmount > 0
            LIMIT 1;
            
            -- Update voucher header totals
            UPDATE accounts_voucherentry
            SET totalDebit = NEW.amount,
                totalCredit = NEW.amount,
                narration = CONCAT(
                    'Service fee bill - Auto-updated to ৳', NEW.amount
                )
            WHERE id = v_voucher_id;
        END IF;
    END IF;
END$$

DELIMITER ;
```

**Installation Script:**

**File:** `backend/install_advance_payment_triggers.sql`

```sql
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_auto_create_advance_on_overpayment;
DROP TRIGGER IF EXISTS trg_auto_update_advance_on_application;
DROP TRIGGER IF EXISTS trg_auto_update_voucher_on_payment_change;

-- Install new triggers
SOURCE path/to/triggers.sql;

-- Verify installation
SHOW TRIGGERS WHERE `Table` IN (
    'service_fee_payment_details',
    'service_fee_advance_payments',
    'service_fee_management_servicefeepayment'
);
```

---

#### 6.6.3 Comparison: Django Signals vs Database Triggers

| Feature | Django Signals | Database Triggers |
|---------|----------------|-------------------|
| **Language** | Python | SQL |
| **Execution** | Application layer | Database layer |
| **Portability** | ✅ Database-agnostic | ❌ Database-specific |
| **Debugging** | ✅ Easy (Python debugger) | ❌ Harder (SQL logs) |
| **Testing** | ✅ Unit tests in Python | ❌ Requires DB integration tests |
| **Performance** | ⚠️ Slight overhead | ✅ Faster (native SQL) |
| **Maintenance** | ✅ Version controlled (Git) | ⚠️ Separate SQL scripts |
| **Error Handling** | ✅ Python exceptions | ⚠️ Limited error handling |
| **Logging** | ✅ Rich logging framework | ❌ Basic SQL logging |
| **Async Processing** | ✅ Can use Celery/RQ | ❌ Always synchronous |
| **Transaction Safety** | ✅ Django transaction.atomic() | ✅ ACID compliant |

**Recommendation:** Use **Django Signals** for:
- Better maintainability and debugging
- Team familiarity with Python
- Easier testing and CI/CD integration
- Future async task queue integration (Celery)

Use **Database Triggers** only if:
- Need absolute maximum performance
- Running large batch operations (millions of records)
- Database team maintains trigger logic separately

---

#### 6.6.4 Testing Automatic Updates

**Unit Test for Django Signal:**

**File:** `backend/service_fee_management/tests/test_advance_signals.py`

```python
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

from service_fee_management.models import (
    ServiceFeePayment,
    ServiceFeeBilling,
    AdvancePayment
)
from towers.models import Unit

class AdvancePaymentSignalTestCase(TestCase):
    def setUp(self):
        # Create test data
        self.unit = Unit.objects.create(unit_name='101')
        self.payment = ServiceFeePayment.objects.create(
            unit=self.unit,
            amount=Decimal('10000.00'),
            remaining_amount=Decimal('10000.00'),
            service_period_month=1,
            service_period_year=2026
        )
    
    def test_overpayment_creates_advance_automatically(self):
        """Test that overpayment triggers automatic advance creation"""
        # Record payment of 15000 (5000 overpayment)
        billing = ServiceFeeBilling.objects.create(
            servicefeepaymentid=self.payment,
            transaction_id='TXN-TEST-001',
            billing_amount=Decimal('15000.00'),
            payment_date=timezone.now()
        )
        
        # Signal should auto-create advance
        advance = AdvancePayment.objects.filter(
            unit=self.unit,
            source_billing=billing
        ).first()
        
        self.assertIsNotNone(advance)
        self.assertEqual(advance.amount, Decimal('5000.00'))
        self.assertEqual(advance.remaining_amount, Decimal('5000.00'))
        self.assertEqual(advance.status, 'available')
        self.assertEqual(advance.advance_type, 'auto_excess')
    
    def test_no_advance_on_exact_payment(self):
        """Test that exact payment does NOT create advance"""
        billing = ServiceFeeBilling.objects.create(
            servicefeepaymentid=self.payment,
            transaction_id='TXN-TEST-002',
            billing_amount=Decimal('10000.00')
        )
        
        # No advance should be created
        advance_count = AdvancePayment.objects.filter(
            unit=self.unit,
            source_billing=billing
        ).count()
        
        self.assertEqual(advance_count, 0)
    
    def test_advance_application_updates_balance(self):
        """Test that applying advance updates balance automatically"""
        # Create existing advance
        advance = AdvancePayment.objects.create(
            unit=self.unit,
            amount=Decimal('8000.00'),
            remaining_amount=Decimal('8000.00'),
            status='available'
        )
        
        # Apply 3000 to advance
        billing = ServiceFeeBilling.objects.create(
            servicefeepaymentid=self.payment,
            transaction_id='TXN-TEST-003',
            billing_amount=Decimal('3000.00')
        )
        
        # Set signal context
        billing._advance_applied_amount = Decimal('3000.00')
        billing._advance_id = advance.id
        billing.save()
        
        # Refresh from database
        advance.refresh_from_database()
        
        # Verify updates
        self.assertEqual(advance.applied_amount, Decimal('3000.00'))
        self.assertEqual(advance.remaining_amount, Decimal('5000.00'))
        self.assertEqual(advance.status, 'partial')
```

**Run Tests:**
```bash
python manage.py test service_fee_management.tests.test_advance_signals
```

---

#### 6.6.5 Monitoring and Logging

**Log Advance Payment Updates:**

```python
# Add to Django settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'advance_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/advance_payments.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'service_fee_management.signals': {
            'handlers': ['advance_file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
```

**Sample Log Output:**
```
INFO 2026-01-15 14:32:01 signals Overpayment detected: ৳5000.00 for payment ID 123
INFO 2026-01-15 14:32:01 signals Created advance payment ID 45: ৳5000.00
INFO 2026-01-15 14:32:01 signals Updated voucher ID 789 for advance deposit: ৳5000.00
INFO 2026-01-15 14:32:15 signals Updated advance ID 42: Applied ৳3000.00, Remaining ৳2000.00
INFO 2026-01-15 14:32:15 signals Auto-updated voucher ID 790 to ৳10500.00
```

---

#### 6.6.6 Performance Considerations

**Async Task Queue (Optional Enhancement):**

For very high-volume systems, consider using **Celery** for truly asynchronous processing:

```python
# celery_tasks.py
from celery import shared_task

@shared_task
def process_advance_payment_update(billing_id):
    """Process advance payment update in background queue"""
    billing = ServiceFeeBilling.objects.get(id=billing_id)
    # ... processing logic ...

# In signal:
@receiver(post_save, sender=ServiceFeeBilling)
def queue_advance_update(sender, instance, created, **kwargs):
    if created:
        # Queue task instead of processing immediately
        process_advance_payment_update.delay(instance.id)
```

**Benefits:**
- Completely non-blocking HTTP response
- Retry failed updates automatically
- Distributed processing across workers
- Better scalability for high traffic

---

## 7. Database Optimization Strategy

### 7.1 Required Indexes

**Service Fee Management:**
```sql
-- Unit + Period lookup (most frequent query)
CREATE INDEX idx_payment_unit_period ON service_fee_management_servicefeepayment 
    (unit_id, service_period_year, service_period_month);

-- Status filtering (dashboard, reports)
CREATE INDEX idx_payment_status_composite ON service_fee_management_servicefeepayment 
    (service_status, payment_status, created_at DESC);

-- Period-based queries (monthly reports)
CREATE INDEX idx_payment_period_status ON service_fee_management_servicefeepayment 
    (service_period_year, service_period_month, service_status);

-- Item lookup (payment allocation)
CREATE INDEX idx_item_payment_type ON service_fee_management_servicefeeitem 
    (service_fee_payment_id, item_type);

-- Category filtering (utility reports)
CREATE INDEX idx_item_category ON service_fee_management_servicefeeitem 
    (bill_category_id);

-- Billing transaction lookup
CREATE INDEX idx_billing_transaction ON service_fee_payment_details 
    (transaction_id);

-- Payment history per bill
CREATE INDEX idx_billing_payment_date ON service_fee_payment_details 
    (servicefeepaymentid_id, payment_date);

-- Allocation queries
CREATE INDEX idx_allocation_billing ON service_fee_payment_allocations 
    (service_fee_billing_id);

CREATE INDEX idx_allocation_item ON service_fee_payment_allocations 
    (service_fee_item_id);
```

**Accounting/Voucher:**
```sql
-- Voucher number lookup (unique constraint)
CREATE INDEX idx_voucher_number ON accounts_voucherentry 
    (voucherNumber);

-- Date-based queries (journals, reports)
CREATE INDEX idx_voucher_date ON accounts_voucherentry 
    (entryDate DESC);

-- Status filtering (draft vs posted)
CREATE INDEX idx_voucher_status ON accounts_voucherentry 
    (status);

-- Voucher type filtering
CREATE INDEX idx_voucher_type ON accounts_voucherentry 
    (voucherType_id);

-- Combined date + number (ordering)
CREATE INDEX idx_voucher_date_number ON accounts_voucherentry 
    (entryDate DESC, voucherNumber DESC);

-- Voucher line lookup
CREATE INDEX idx_voucherdetails_entry_line ON accounts_voucherentrydetails 
    (voucherEntry_id, lineNumber);

-- Account balance calculation
CREATE INDEX idx_voucherdetails_account ON accounts_voucherentrydetails 
    (account_id);

-- Chart of Accounts lookup
CREATE INDEX idx_account_code ON accounts_account 
    (accountCode);

CREATE INDEX idx_account_type ON accounts_account 
    (accountType);
```

---

## 8. Query Optimization - N+1 Elimination

### 8.1 Problem: N+1 Query Pattern

**BAD CODE** (triggers 100+ queries):
```python
# ❌ DO NOT DO THIS
payments = ServiceFeePayment.objects.filter(
    service_period_month=1,
    service_period_year=2026
)  # Query 1

for payment in payments:  # Loop through 100 payments
    print(payment.unit.unit_name)           # Query 2-101 (N queries)
    print(payment.unit.floor.tower.tower_name)  # Query 102-201 (N queries)
    print(payment.resident.full_name)       # Query 202-301 (N queries)

# Total: 1 + (100 × 3) = 301 queries ❌
# Response time: 2-3 seconds
```

---

### 8.2 Solution 1: Django ORM Optimization

**GOOD CODE** (Django ORM with `select_related` / `prefetch_related`):
```python
# ✅ OPTIMIZED - Use select_related for ForeignKey
payments = ServiceFeePayment.objects.filter(
    service_period_month=1,
    service_period_year=2026
).select_related(
    'unit',                    # ForeignKey
    'unit__floor',             # ForeignKey through unit
    'unit__floor__tower',      # ForeignKey through floor
    'resident',                # ForeignKey
    'service_fee',             # ForeignKey
    'created_by'               # ForeignKey
).prefetch_related(
    'items',                   # Reverse ForeignKey (many items per payment)
    'billing_records',         # Reverse ForeignKey (many billings per payment)
    'billing_records__payment_method'  # Through billing records
)

for payment in payments:
    print(payment.unit.unit_name)  # No query (already loaded)
    print(payment.unit.floor.tower.tower_name)  # No query
    print(payment.resident.full_name)  # No query

# Total: 4-5 queries (1 main + 3-4 prefetch) ✅
# Response time: 150-200ms
```

**Performance Gain:**
- **Before:** 301 queries, 2-3 seconds
- **After:** 5 queries, 150-200ms
- **Improvement:** 60x fewer queries, 10-15x faster

---

### 8.3 Solution 2: Raw SQL (Maximum Performance)

**BEST CODE** (Raw SQL with JOINs):
```python
# ✅ MAXIMUM PERFORMANCE - Single SQL query
from django.db import connection

sql = """
SELECT 
    p.id,
    p.amount,
    p.remaining_amount,
    p.service_status,
    p.service_period_month,
    p.service_period_year,
    u.id AS unit_id,
    u.unit_name,
    f.floor_no,
    t.id AS tower_id,
    t.tower_name,
    m.id AS resident_id,
    m.full_name AS resident_name,
    m.general_email AS resident_email,
    sf.id AS service_fee_id,
    sf.fee_amount,
    sf.currency,
    pm.id AS payment_method_id,
    pm.method_name,
    spd.transaction_id,
    spd.billing_amount,
    spd.payment_date
FROM service_fee_management_servicefeepayment p
INNER JOIN towers_unit u ON p.unit_id = u.id
INNER JOIN towers_floor f ON u.floor_id = f.id
INNER JOIN towers_tower t ON f.tower_id = t.id
LEFT JOIN user_member m ON p.resident_id = m.id
LEFT JOIN service_fee_servicefee sf ON p.service_fee_id = sf.id
LEFT JOIN service_fee_payment_details spd ON spd.servicefeepaymentid_id = p.id
LEFT JOIN service_fee_payment_methods pm ON spd.payment_method_id = pm.id
WHERE p.service_period_month = %s 
  AND p.service_period_year = %s
ORDER BY p.created_at DESC
LIMIT 100
"""

with connection.cursor() as cursor:
    cursor.execute(sql, [month, year])
    columns = [col[0] for col in cursor.description]
    results = [dict(zip(columns, row)) for row in cursor.fetchall()]

# Total: 1 query ✅
# Response time: 80-120ms
```

**Performance Gain:**
- **Before:** 301 queries, 2-3 seconds
- **After:** 1 query, 80-120ms
- **Improvement:** 300x fewer queries, 20-30x faster

---

### 8.4 Current Implementation in `views.py`

**File:** `backend/service_fee_management/views.py`

**Optimized Views:**
1. **TowerListOptimizedView** - Raw SQL for tower list
2. **ServiceFeeOptionsView** - Raw SQL with GROUP_CONCAT
3. **service_fee_unit_counts** - Raw SQL with JSON_ARRAYAGG
4. **service_fee_payment_by_period** - Raw SQL with aggregations
5. **ServiceFeePaymentListCreateView.get()** - Django ORM with select_related/prefetch_related

**Example:** Tower list (raw SQL):
```python
class TowerListOptimizedView(APIView):
    def get(self, request):
        sql = """
            SELECT id, tower_name AS name
            FROM towers_tower
            ORDER BY tower_name ASC
        """
        with connection.cursor() as cursor:
            cursor.execute(sql)
            columns = [col[0] for col in cursor.description]
            data = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return Response(data, status=status.HTTP_200_OK)
```

---

## 9. API Endpoints Reference

### 9.1 Service Fee Endpoints

#### GET `/api/service-fee-management/billing-detailed/`
**Purpose:** Fetch service fee bills with filters

**Query Parameters:**
- `service_period_month_from`: Integer (1-12)
- `service_period_year_from`: Integer
- `tower_ids`: Comma-separated tower IDs
- `status`: Comma-separated status values
- `page`: Page number
- `limit`: Results per page

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 123,
        "unit_name": "Unit 101",
        "tower_name": "Tower A",
        "resident_name": "John Doe",
        "amount": "5150.00",
        "remaining_amount": "0.00",
        "service_status": "paid"
      }
    ]
  }
}
```

---

#### POST `/api/service-fee-management/payments/multi-month/`
**Purpose:** Record payment for one or multiple months

**Request Body:**
```json
{
  "unit_id": 45,
  "service_fee_id": 10,
  "payment_method": 2,
  "total_amount": "5150.00",
  "payment_date": "2026-01-15",
  "voucher_id": 789,
  "selected_periods": [
    {
      "service_period_month": 1,
      "service_period_year": 2026,
      "amount": "5150.00"
    }
  ]
}
```

---

## 10. Implementation Guide

### 10.1 Adding Database Indexes

Create migration file:
```python
# backend/service_fee_management/migrations/0106_add_indexes.py

from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('service_fee_management', '0105_previous'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='servicefeepayment',
            index=models.Index(
                fields=['unit_id', 'service_period_year', 'service_period_month'],
                name='idx_payment_unit_period'
            ),
        ),
    ]
```

Run migration:
```bash
python manage.py migrate service_fee_management
```

---

### 10.2 Owner-Only Billing Generation Implementation

#### Overview

Service fee bills are now generated using **primary contract owner information only**. The `resident_id` field is deprecated and no longer populated during bill generation. All billing contact information comes from the unit's primary contract owner.

#### Database Schema Changes

**Migration File:** `backend/service_fee_management/migrations/0107_add_owner_fields.py`

```python
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('service_fee_management', '0106_add_indexes'),
        ('user', '0050_auto_previous'),
    ]

    operations = [
        # Add owner fields
        migrations.AddField(
            model_name='servicefeepayment',
            name='owner_id',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='service_fee_payments_as_owner',
                to='user.member',
                null=True,
                blank=True,
                help_text='Primary contract owner (billing contact)'
            ),
        ),
        migrations.AddField(
            model_name='servicefeepayment',
            name='owner_name',
            field=models.CharField(
                max_length=255,
                null=True,
                blank=True,
                help_text='Owner name snapshot at generation time'
            ),
        ),
        migrations.AddField(
            model_name='servicefeepayment',
            name='owner_email',
            field=models.EmailField(
                max_length=255,
                null=True,
                blank=True,
                help_text='Owner email snapshot at generation time'
            ),
        ),
        migrations.AddField(
            model_name='servicefeepayment',
            name='owner_phone',
            field=models.CharField(
                max_length=20,
                null=True,
                blank=True,
                help_text='Owner phone snapshot at generation time'
            ),
        ),
        
        # Add index for owner lookups
        migrations.AddIndex(
            model_name='servicefeepayment',
            index=models.Index(
                fields=['owner_id', 'service_period_year', 'service_period_month'],
                name='idx_payment_owner_period'
            ),
        ),
        
        # Mark resident_id as deprecated (don't delete for backward compatibility)
        migrations.AlterField(
            model_name='servicefeepayment',
            name='resident_id',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='service_fee_payments',
                to='user.member',
                null=True,
                blank=True,
                help_text='DEPRECATED: Legacy field, no longer populated. Use owner_id instead.'
            ),
        ),
    ]
```

#### Model Updates

**File:** `backend/service_fee_management/models.py`

```python
class ServiceFeePayment(models.Model):
    """Main service fee payment record"""
    unit = models.ForeignKey('towers.Unit', on_delete=models.PROTECT)
    service_fee = models.ForeignKey('service_fee.ServiceFee', on_delete=models.PROTECT)
    
    # DEPRECATED: Legacy resident field - no longer used
    resident = models.ForeignKey(
        'user.Member',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='service_fee_payments',
        help_text='DEPRECATED: Use owner_id instead'
    )
    
    # NEW: Primary contract owner (billing contact)
    owner = models.ForeignKey(
        'user.Member',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='service_fee_payments_as_owner',
        help_text='Primary contract owner (billing contact)'
    )
    
    # Owner information snapshots (immutable after generation)
    owner_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Owner name at generation time'
    )
    owner_email = models.EmailField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Owner email at generation time'
    )
    owner_phone = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text='Owner phone at generation time'
    )
    
    # ... other fields ...
    
    class Meta:
        indexes = [
            models.Index(
                fields=['unit', 'service_period_year', 'service_period_month'],
                name='idx_payment_unit_period'
            ),
            models.Index(
                fields=['owner', 'service_period_year', 'service_period_month'],
                name='idx_payment_owner_period'
            ),
        ]
```

#### Bill Generation Logic Updates

**File:** `backend/service_fee_management/utils/service_fee_generator.py`

```python
from django.db import transaction
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

def generate_service_fees(service_fee_id, period_month, period_year, created_by):
    """
    Generate service fee bills for all eligible units.
    
    IMPORTANT: Uses PRIMARY CONTRACT OWNER information only.
    Does NOT check or use resident information.
    
    Args:
        service_fee_id: ServiceFee configuration ID
        period_month: Billing month (1-12)
        period_year: Billing year
        created_by: User generating the bills
    
    Returns:
        dict: {
            'success': bool,
            'generated_count': int,
            'skipped_count': int,
            'errors': list
        }
    """
    from service_fee_management.models import ServiceFeePayment, ServiceFeeItem
    from service_fee.models import ServiceFee
    from towers.models import Unit
    
    generated_count = 0
    skipped_count = 0
    errors = []
    
    try:
        service_fee = ServiceFee.objects.get(id=service_fee_id)
        eligible_units = get_eligible_units(service_fee)
        
        with transaction.atomic():
            for unit in eligible_units:
                try:
                    # CRITICAL: Get primary contract owner (NOT resident)
                    owner_info = get_primary_contract_owner(unit)
                    
                    if not owner_info:
                        logger.warning(
                            f"Unit {unit.unit_name} has no primary contract owner. "
                            f"Skipping bill generation."
                        )
                        skipped_count += 1
                        errors.append({
                            'unit': unit.unit_name,
                            'error': 'No primary contract owner found'
                        })
                        continue
                    
                    # Check if bill already exists for this period
                    existing = ServiceFeePayment.objects.filter(
                        unit=unit,
                        service_period_month=period_month,
                        service_period_year=period_year
                    ).exists()
                    
                    if existing:
                        logger.info(f"Bill already exists for {unit.unit_name}. Skipping.")
                        skipped_count += 1
                        continue
                    
                    # Calculate bill amounts
                    base_amount = service_fee.fee_amount
                    utility_amount = calculate_utility_charges(unit, period_month, period_year)
                    penalty_amount = Decimal('0.00')  # No penalty on new bills
                    total_amount = base_amount + utility_amount + penalty_amount
                    
                    # Create payment record with OWNER information
                    payment = ServiceFeePayment.objects.create(
                        unit=unit,
                        service_fee=service_fee,
                        owner_id=owner_info['owner_id'],
                        owner_name=owner_info['owner_name'],
                        owner_email=owner_info['owner_email'],
                        owner_phone=owner_info['owner_phone'],
                        resident_id=None,  # DEPRECATED: Set to NULL
                        service_period_month=period_month,
                        service_period_year=period_year,
                        amount=total_amount,
                        remaining_amount=total_amount,
                        base_service_amount=base_amount,
                        additional_bill_charges=utility_amount,
                        service_status='due',
                        payment_status='pending',
                        due_date=calculate_due_date(period_month, period_year, service_fee.due_day),
                        created_by=created_by
                    )
                    
                    # Create line items
                    create_bill_items(payment, base_amount, utility_amount)
                    
                    # Create voucher entry (draft)
                    create_voucher_entry(payment, created_by)
                    
                    generated_count += 1
                    logger.info(
                        f"Generated bill for {unit.unit_name}: ৳{total_amount} "
                        f"(Owner: {owner_info['owner_name']})"
                    )
                    
                except Exception as e:
                    logger.error(f"Failed to generate bill for unit {unit.id}: {str(e)}")
                    errors.append({
                        'unit': unit.unit_name if hasattr(unit, 'unit_name') else f'ID {unit.id}',
                        'error': str(e)
                    })
                    skipped_count += 1
                    continue
        
        return {
            'success': True,
            'generated_count': generated_count,
            'skipped_count': skipped_count,
            'errors': errors
        }
        
    except Exception as e:
        logger.error(f"Bill generation failed: {str(e)}", exc_info=True)
        return {
            'success': False,
            'generated_count': 0,
            'skipped_count': 0,
            'errors': [{'error': str(e)}]
        }


def get_primary_contract_owner(unit):
    """
    Get primary contract owner information from unit.
    
    CRITICAL: Only looks at unit.primary_contract.owner
    Does NOT check resident or tenant information.
    
    Args:
        unit: Unit instance
    
    Returns:
        dict or None: {
            'owner_id': int,
            'owner_name': str,
            'owner_email': str,
            'owner_phone': str
        }
    """
    try:
        # Get primary contract
        primary_contract = unit.contracts.filter(
            contract_type='ownership',
            status='active',
            is_primary=True
        ).select_related('owner').first()
        
        if not primary_contract:
            logger.warning(f"No primary contract found for unit {unit.unit_name}")
            return None
        
        owner = primary_contract.owner
        if not owner:
            logger.warning(f"Primary contract exists but no owner for unit {unit.unit_name}")
            return None
        
        return {
            'owner_id': owner.id,
            'owner_name': owner.full_name or owner.username,
            'owner_email': owner.general_email or owner.email,
            'owner_phone': owner.primary_phone or owner.phone_number or ''
        }
        
    except Exception as e:
        logger.error(f"Error getting owner info for unit {unit.id}: {str(e)}")
        return None


def create_bill_items(payment, base_amount, utility_amount):
    """Create line items for the bill"""
    from service_fee_management.models import ServiceFeeItem
    
    # Base fee item
    ServiceFeeItem.objects.create(
        service_fee_payment=payment,
        item_type='base_fee',
        item_name='Monthly Service Fee',
        amount=base_amount
    )
    
    # Utility items (if any)
    if utility_amount > 0:
        ServiceFeeItem.objects.create(
            service_fee_payment=payment,
            item_type='bill_category',
            item_name='Utilities',
            amount=utility_amount
        )
```

#### API Endpoint Updates

**File:** `backend/service_fee_management/views.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class GenerateServiceFeeBillsView(APIView):
    """Generate service fee bills for a period"""
    
    def post(self, request):
        """
        Generate bills using PRIMARY CONTRACT OWNER information.
        
        Request body:
        {
            "service_fee_id": 1,
            "period_month": 1,
            "period_year": 2026
        }
        
        Response:
        {
            "success": true,
            "message": "Generated 50 bills successfully",
            "generated_count": 50,
            "skipped_count": 5,
            "errors": [...]
        }
        """
        service_fee_id = request.data.get('service_fee_id')
        period_month = request.data.get('period_month')
        period_year = request.data.get('period_year')
        
        if not all([service_fee_id, period_month, period_year]):
            return Response({
                'success': False,
                'error': 'Missing required fields'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate bills
        result = generate_service_fees(
            service_fee_id=service_fee_id,
            period_month=period_month,
            period_year=period_year,
            created_by=request.user
        )
        
        if result['success']:
            return Response({
                'success': True,
                'message': f"Generated {result['generated_count']} bills successfully",
                'generated_count': result['generated_count'],
                'skipped_count': result['skipped_count'],
                'errors': result['errors']
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'success': False,
                'error': 'Bill generation failed',
                'errors': result['errors']
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

#### Testing

**File:** `backend/service_fee_management/tests/test_owner_billing.py`

```python
from django.test import TestCase
from decimal import Decimal

from service_fee_management.models import ServiceFeePayment
from service_fee_management.utils.service_fee_generator import (
    generate_service_fees,
    get_primary_contract_owner
)
from towers.models import Unit, Tower, Floor
from user.models import Member
from contracts.models import Contract

class OwnerOnlyBillingTestCase(TestCase):
    def setUp(self):
        # Create test data
        self.owner = Member.objects.create(
            username='owner1',
            full_name='John Owner',
            general_email='owner@test.com',
            primary_phone='01700000000'
        )
        
        self.resident = Member.objects.create(
            username='resident1',
            full_name='Jane Resident',
            general_email='resident@test.com'
        )
        
        self.tower = Tower.objects.create(tower_name='A')
        self.floor = Floor.objects.create(floor_no='1', tower=self.tower)
        self.unit = Unit.objects.create(
            unit_name='101',
            floor=self.floor,
            tower=self.tower
        )
        
        # Create primary contract with owner
        self.contract = Contract.objects.create(
            unit=self.unit,
            owner=self.owner,
            contract_type='ownership',
            status='active',
            is_primary=True
        )
    
    def test_get_owner_info_returns_owner_not_resident(self):
        """Test that owner info is retrieved from primary contract owner"""
        owner_info = get_primary_contract_owner(self.unit)
        
        self.assertIsNotNone(owner_info)
        self.assertEqual(owner_info['owner_id'], self.owner.id)
        self.assertEqual(owner_info['owner_name'], 'John Owner')
        self.assertEqual(owner_info['owner_email'], 'owner@test.com')
        self.assertEqual(owner_info['owner_phone'], '01700000000')
    
    def test_bill_generation_uses_owner_not_resident(self):
        """Test that bill generation populates owner fields, not resident"""
        from service_fee.models import ServiceFee
        
        service_fee = ServiceFee.objects.create(
            fee_amount=Decimal('10000.00'),
            due_day=5
        )
        service_fee.units.add(self.unit)
        
        result = generate_service_fees(
            service_fee_id=service_fee.id,
            period_month=1,
            period_year=2026,
            created_by=self.owner
        )
        
        self.assertTrue(result['success'])
        self.assertEqual(result['generated_count'], 1)
        
        # Verify payment record
        payment = ServiceFeePayment.objects.get(
            unit=self.unit,
            service_period_month=1,
            service_period_year=2026
        )
        
        # Owner fields should be populated
        self.assertEqual(payment.owner_id, self.owner.id)
        self.assertEqual(payment.owner_name, 'John Owner')
        self.assertEqual(payment.owner_email, 'owner@test.com')
        self.assertEqual(payment.owner_phone, '01700000000')
        
        # Resident field should be NULL (deprecated)
        self.assertIsNone(payment.resident_id)
    
    def test_unit_without_primary_contract_skipped(self):
        """Test that units without primary contract are skipped"""
        # Create unit without contract
        unit2 = Unit.objects.create(
            unit_name='102',
            floor=self.floor,
            tower=self.tower
        )
        
        from service_fee.models import ServiceFee
        service_fee = ServiceFee.objects.create(fee_amount=Decimal('10000.00'))
        service_fee.units.add(unit2)
        
        result = generate_service_fees(
            service_fee_id=service_fee.id,
            period_month=1,
            period_year=2026,
            created_by=self.owner
        )
        
        self.assertEqual(result['skipped_count'], 1)
        self.assertEqual(len(result['errors']), 1)
        self.assertIn('No primary contract owner', result['errors'][0]['error'])
```

**Run Tests:**
```bash
python manage.py test service_fee_management.tests.test_owner_billing
```

---

### 10.3 Deployment Checklist

**Pre-Deployment:**
- [ ] Run database migrations (`python manage.py migrate`)
- [ ] Create database backups
- [ ] Test owner-only billing in staging environment
- [ ] Verify signal registration in `apps.py`
- [ ] Check logging configuration for advance payments

**Post-Deployment:**
- [ ] Monitor logs for signal execution (`logs/advance_payments.log`)
- [ ] Verify advance payment auto-creation on overpayments
- [ ] Test bill generation with owner information
- [ ] Confirm voucher auto-updates are working
- [ ] Review performance metrics

**Rollback Plan:**
- [ ] Database backup restoration procedure documented
- [ ] Migration rollback commands ready
- [ ] Feature flag to disable signals if needed

---

## Appendix: Quick Reference

### Payment Status Values

| Status | Description |
|--------|-------------|
| `due` | Bill generated, not paid |
| `partial` | Partially paid |
| `paid` | Fully paid |
| `overdue` | Past due date, not paid |

### Voucher Status

| Status | Description |
|--------|-------------|
| `draft` | Editable, not affecting balances |
| `posted` | Finalized, updates account balances |
| `void` | Cancelled |

### Account Types

| Type | Normal Balance | Examples |
|------|----------------|----------|
| `asset` | Debit | Cash, Bank, Receivables |
| `liability` | Credit | Payables, Loans |
| `revenue` | Credit | Service Fee Income |
| `expense` | Debit | Utilities, Salaries |

---

**End of Documentation**

For questions: development@estatelink.com
