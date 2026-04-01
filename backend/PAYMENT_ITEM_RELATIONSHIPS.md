# Payment Item Relationships & Table Structure

## Concept Overview

**Goal:** Track what items/components were paid in each payment transaction.

---

## Table Relationships

### **Parent Table: `service_fee_management_servicefeepayment`**
(Main Payment Transaction Record)

```
Fields:
├── id (PK)
├── unit_id (FK → towers_unit)
├── service_fee_id (FK → service_fee_servicefee)
├── service_period_month
├── service_period_year
├── base_service_amount (amount for base fee)
├── additional_bill_charges (sum of all bill categories)
├── amount (total payment received)
├── service_status (due|partial|paid|overdue)
└── payment_status (pending|completed|failed|cancelled|refunded)

Example Record:
id=1, unit_id=87, service_fee_id=5
service_period_month=12, service_period_year=2025
base_service_amount=2000, additional_bill_charges=200
amount=4500 (total payment input)
```

**Purpose:** Store the main payment transaction details

---

### **Child Table: `service_fee_payment_detail`**
(Payment Breakdown by Items - NEW TABLE)

```
Fields:
├── id (PK)
├── service_fee_payment_id (FK → service_fee_management_servicefeepayment) ⭐ KEY RELATIONSHIP
├── service_fee_billing_id (FK → service_fee_payment_details)
├── payment_type (penalty | base_fee | bill_category)
├── amount_paid (amount paid for this item)
├── penalty_waiver_id (FK → service_fee_penalty_waivers, optional)
├── bill_category_id (FK → bill_categories_billcategory, optional)
└── created_at

Example Records (for service_fee_payment_id=1):
id=1, payment_id=1, payment_type='penalty', amount_paid=250
id=2, payment_id=1, payment_type='base_fee', amount_paid=2000
id=3, payment_id=1, payment_type='bill_category', amount_paid=100, bill_category_id=1
id=4, payment_id=1, payment_type='bill_category', amount_paid=100, bill_category_id=2
id=5, payment_id=1, payment_type='bill_category', amount_paid=100, bill_category_id=3
```

**Purpose:** Track which items were paid and how much for each item

---

## Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ service_fee_management_servicefeepayment (PARENT)           │
│ One payment record per transaction                          │
│                                                             │
│  id=1                                                       │
│  unit_id=87, service_fee_id=5                             │
│  service_period=12/2025                                    │
│  base_service_amount=2000                                  │
│  additional_bill_charges=200                               │
│  amount=4500 (TOTAL PAYMENT RECEIVED)                      │
│  service_status='paid'                                     │
│  payment_status='completed'                                │
└───────────────────────┬─────────────────────────────────────┘
                        │ 1:N Relationship
                        │ (one payment → many items)
                        │
        ┌───────────────┼───────────────┬───────────────┐
        │               │               │               │
        ▼               ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Payment Item │ │ Payment Item │ │ Payment Item │ │ Payment Item │
│              │ │              │ │              │ │              │
│ id=1         │ │ id=2         │ │ id=3         │ │ id=4         │
│ payment_id=1 │ │ payment_id=1 │ │ payment_id=1 │ │ payment_id=1 │
│ type='penalty'│ │type='base_fee'│ │type='bill_'  │ │type='bill_'  │
│ amount=250   │ │ amount=2000  │ │ category'    │ │ category'    │
│              │ │              │ │ amount=100   │ │ amount=100   │
│ Links to:    │ │ Links to:    │ │ Links to:    │ │ Links to:    │
│ penalty_     │ │ NONE (null)  │ │ bill_        │ │ bill_        │
│ waiver_id=1  │ │              │ │ category_id=1│ │ category_id=2│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │                              │                │
        ▼                              ▼                ▼
┌──────────────────┐      ┌──────────────────┐  ┌──────────────────┐
│ PenaltyWaiver    │      │ BillCategory 1   │  │ BillCategory 2   │
│ (Optional FK)    │      │ (Maintenance)    │  │ (Cleaning)       │
└──────────────────┘      └──────────────────┘  └──────────────────┘
```

---

## How It Works (Flow)

### **Step 1: Payment Received**
User makes a payment of **4500 TK**

```python
payment = ServiceFeePayment.objects.create(
    unit_id=87,
    service_fee_id=5,
    amount=4500,  # Total payment input
    base_service_amount=2000,
    additional_bill_charges=200,
    # ... other fields
)
print(f"Created payment: id={payment.id}, amount={payment.amount}")
# Output: Created payment: id=1, amount=4500
```

---

### **Step 2: Allocate Payment to Items (Hierarchy)**

**Initialize:**
```python
remaining = 4500 TK
```

**Step 2.1: Pay Penalty (FIRST)**
```python
penalty_net = 250 - 0 = 250 TK

ServiceFeePaymentDetail.objects.create(
    service_fee_payment_id=1,  # Link to parent payment
    service_fee_billing_id=101,
    payment_type='penalty',
    amount_paid=250,
    penalty_waiver_id=1,  # Link to penalty record
    description='Late payment penalty'
)

remaining = 4500 - 250 = 4250 TK
```

**Step 2.2: Pay Base Fee (SECOND)**
```python
base_fee_owed = 2000 TK

ServiceFeePaymentDetail.objects.create(
    service_fee_payment_id=1,  # Link to parent payment
    service_fee_billing_id=101,
    payment_type='base_fee',
    amount_paid=2000,
    penalty_waiver_id=None,  # No link
    bill_category_id=None,  # No link
    description='Base service fee'
)

remaining = 4250 - 2000 = 2250 TK
```

**Step 2.3: Pay Bill Categories (THIRD)**
```python
# Category 1: Maintenance (100 TK)
ServiceFeePaymentDetail.objects.create(
    service_fee_payment_id=1,
    service_fee_billing_id=101,
    payment_type='bill_category',
    amount_paid=100,
    bill_category_id=1,  # Link to category
    description='Maintenance: 100 TK'
)
remaining = 2250 - 100 = 2150 TK

# Category 2: Cleaning (100 TK)
ServiceFeePaymentDetail.objects.create(
    service_fee_payment_id=1,
    service_fee_billing_id=101,
    payment_type='bill_category',
    amount_paid=100,
    bill_category_id=2,  # Link to category
    description='Cleaning: 100 TK'
)
remaining = 2150 - 100 = 2050 TK

# Category 3: Water (100 TK)
ServiceFeePaymentDetail.objects.create(
    service_fee_payment_id=1,
    service_fee_billing_id=101,
    payment_type='bill_category',
    amount_paid=100,
    bill_category_id=3,  # Link to category
    description='Water: 100 TK'
)
remaining = 2050 - 100 = 1950 TK
```

**Step 2.4: Handle Excess (FOURTH)**
```python
if remaining > 0:
    AdvancePayment.objects.create(
        unit_id=87,
        resident_id=10,
        advance_type='auto_excess',
        amount=1950,
        source_payment_id=1,  # Link to source payment
        # NOT in payment_details table
    )
```

---

## Query Examples

### Get all items paid in a payment:
```python
payment = ServiceFeePayment.objects.get(id=1)
details = payment.payment_details.all()  # Uses related_name from FK

print(f"Payment {payment.id} has {details.count()} items:")
for detail in details:
    print(f"  - {detail.payment_type}: {detail.amount_paid} TK")

# Output:
# Payment 1 has 5 items:
#   - penalty: 250.00 TK
#   - base_fee: 2000.00 TK
#   - bill_category: 100.00 TK (Maintenance)
#   - bill_category: 100.00 TK (Cleaning)
#   - bill_category: 100.00 TK (Water)
```

### Get total paid by type:
```python
from django.db.models import Sum

payment = ServiceFeePayment.objects.get(id=1)

penalty_total = payment.payment_details.filter(
    payment_type='penalty'
).aggregate(total=Sum('amount_paid'))['total'] or 0

base_fee_total = payment.payment_details.filter(
    payment_type='base_fee'
).aggregate(total=Sum('amount_paid'))['total'] or 0

category_total = payment.payment_details.filter(
    payment_type='bill_category'
).aggregate(total=Sum('amount_paid'))['total'] or 0

print(f"Penalty: {penalty_total}")
print(f"Base Fee: {base_fee_total}")
print(f"Categories: {category_total}")
print(f"Total: {penalty_total + base_fee_total + category_total}")

# Output:
# Penalty: 250.00
# Base Fee: 2000.00
# Categories: 300.00
# Total: 2550.00
```

---

## Database Schema (SQL)

### Parent Table
```sql
CREATE TABLE `service_fee_management_servicefeepayment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `unit_id` bigint NOT NULL,
  `service_fee_id` bigint NOT NULL,
  `service_period_month` int NOT NULL,
  `service_period_year` int NOT NULL,
  `base_service_amount` decimal(10,2) NOT NULL,
  `additional_bill_charges` decimal(10,2) NOT NULL DEFAULT 0,
  `amount` decimal(10,2) NOT NULL,
  `service_status` varchar(20) NOT NULL,
  `payment_status` varchar(20) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `service_fee_fk` (`service_fee_id`),
  KEY `unit_fk` (`unit_id`)
) ENGINE=InnoDB;
```

### Child Table
```sql
CREATE TABLE `service_fee_payment_detail` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `service_fee_payment_id` bigint NOT NULL,
  `service_fee_billing_id` bigint NOT NULL,
  `payment_type` varchar(20) NOT NULL,
  `amount_paid` decimal(10,2) NOT NULL,
  `penalty_waiver_id` bigint,
  `bill_category_id` bigint,
  `description` longtext,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `payment_type_idx` (`service_fee_payment_id`, `payment_type`),
  KEY `billing_idx` (`service_fee_billing_id`),
  CONSTRAINT `fk_payment` FOREIGN KEY (`service_fee_payment_id`)
    REFERENCES `service_fee_management_servicefeepayment` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;
```

---

## Key Points

✅ **Parent-Child Relationship:**
- One payment (parent) → Many items (children)
- FK `service_fee_payment_id` creates the relationship

✅ **Item Types (Hierarchy Order):**
1. Penalty (links to `penalty_waiver`)
2. Base Fee (no links)
3. Bill Categories (links to `bill_category`, one per category)

✅ **Tracking What Was Paid:**
- Each row = one item paid
- Tracks amount, type, and related records
- Complete audit trail

✅ **Cascading Delete:**
- Delete parent payment → All child items deleted automatically

✅ **Query Ready:**
- Get all items for a payment
- Filter by type
- Calculate totals by component
- Full breakdown available

---

## Implementation Status

✅ **Parent Table:** Already exists (`service_fee_management_servicefeepayment`)
✅ **Child Table:** Model created + Migration file ready (0089_servicefeepaymentdetail.py)
⏳ **Next:** Apply migration and implement hierarchy logic in views.py

