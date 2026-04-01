# Payment Hierarchy Table Structure

## Overview
The `service_fee_payment_detail` table tracks the breakdown of each payment according to the strict hierarchy (penalty → base fee → bill categories → excess).

---

## Table: `service_fee_payment_detail`

### Schema

| Column Name | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Unique identifier |
| `service_fee_payment_id` | BIGINT | FK → service_fee_management_servicefeepayment | Links to main payment |
| `service_fee_billing_id` | BIGINT | FK → service_fee_payment_details | Links to billing record |
| `payment_type` | VARCHAR(20) | NOT NULL, ENUM | Type of payment: `penalty`, `base_fee`, `bill_category` |
| `amount_paid` | DECIMAL(10,2) | NOT NULL, ≥ 0 | Amount paid for this component |
| `penalty_waiver_id` | BIGINT | FK → service_fee_penalty_waivers, NULL | Links to penalty (if payment_type='penalty') |
| `bill_category_id` | BIGINT | FK → bill_categories_billcategory, NULL | Links to bill category (if payment_type='bill_category') |
| `description` | TEXT | NULL | Details about this component |
| `created_at` | DATETIME | NOT NULL, AUTO_NOW_ADD | Timestamp when record created |

### Indexes

```sql
INDEX idx_payment_type ON service_fee_payment_detail(service_fee_payment_id, payment_type);
INDEX idx_billing ON service_fee_payment_detail(service_fee_billing_id);
```

---

## Hierarchy Flow Example

### Input Payment
```json
{
  "unit_id": 87,
  "service_fee_id": 5,
  "total_amount": 4500,
  "service_period_month": 12,
  "service_period_year": 2025
}
```

### Payment Details Created (Item-wise Hierarchy)

```
Payment ID: 1 (service_fee_management_servicefeepayment.id)
Total Amount: 4500 TK
├─ Penalty (Step 1)
│  └─ Record 1: type='penalty', amount_paid=250
│     └─ Links to: penalty_waiver_id=1
│
├─ Base Fee (Step 2)
│  └─ Record 2: type='base_fee', amount_paid=2000
│     └─ No links (NULL)
│
├─ Bill Categories (Step 3)
│  ├─ Record 3: type='bill_category', amount_paid=100
│  │  └─ Links to: bill_category_id=1 (Maintenance)
│  │
│  ├─ Record 4: type='bill_category', amount_paid=100
│  │  └─ Links to: bill_category_id=2 (Cleaning)
│  │
│  └─ Record 5: type='bill_category', amount_paid=100
│     └─ Links to: bill_category_id=3 (Water)
│
└─ Excess (Step 4)
   └─ NOT in payment_details table
   └─ Instead: AdvancePayment record created with amount=1050
```

---

## SQL Table Definition

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
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `service_fee_payment_type_idx` (
    `service_fee_payment_id`,
    `payment_type`
  ),
  KEY `service_fee_billing_idx` (`service_fee_billing_id`),
  CONSTRAINT `fk_service_fee_payment` FOREIGN KEY (`service_fee_payment_id`) 
    REFERENCES `service_fee_management_servicefeepayment` (`id`) 
    ON DELETE CASCADE,
  CONSTRAINT `fk_service_fee_billing` FOREIGN KEY (`service_fee_billing_id`) 
    REFERENCES `service_fee_payment_details` (`id`) 
    ON DELETE CASCADE,
  CONSTRAINT `fk_penalty_waiver` FOREIGN KEY (`penalty_waiver_id`) 
    REFERENCES `service_fee_penalty_waivers` (`id`) 
    ON DELETE SET NULL,
  CONSTRAINT `fk_bill_category` FOREIGN KEY (`bill_category_id`) 
    REFERENCES `bill_categories_billcategory` (`id`) 
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Data Examples

### Example 1: Full Payment (4500 TK)

| id | service_fee_payment_id | service_fee_billing_id | payment_type | amount_paid | penalty_waiver_id | bill_category_id | description | created_at |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 101 | penalty | 250.00 | 1 | NULL | Late payment penalty | 2026-01-01 10:00:00 |
| 2 | 1 | 101 | base_fee | 2000.00 | NULL | NULL | Base service fee | 2026-01-01 10:00:01 |
| 3 | 1 | 101 | bill_category | 100.00 | NULL | 1 | Maintenance: 100 TK | 2026-01-01 10:00:02 |
| 4 | 1 | 101 | bill_category | 100.00 | NULL | 2 | Cleaning: 100 TK | 2026-01-01 10:00:03 |
| 5 | 1 | 101 | bill_category | 100.00 | NULL | 3 | Water: 100 TK | 2026-01-01 10:00:04 |

**Total Paid:** 250 + 2000 + 100 + 100 + 100 = 2550 TK
**Excess (Advance):** 4500 - 2550 = 1950 TK (saved to AdvancePayment table)

---

### Example 2: Partial Payment (1500 TK)

| id | service_fee_payment_id | service_fee_billing_id | payment_type | amount_paid | penalty_waiver_id | bill_category_id | description | created_at |
|---|---|---|---|---|---|---|---|---|
| 6 | 2 | 102 | penalty | 250.00 | 1 | NULL | Late payment penalty | 2026-01-01 11:00:00 |
| 7 | 2 | 102 | base_fee | 1250.00 | NULL | NULL | Base service fee (partial) | 2026-01-01 11:00:01 |

**Total Paid:** 250 + 1250 = 1500 TK
**Remaining:** 4500 - 1500 = 3000 TK (unpaid for next payment)

---

## Relationships Diagram

```
┌─────────────────────────────────────────┐
│ service_fee_management_servicefeepayment│ (PARENT)
│ (Main Payment Transaction)              │
│                                         │
│ id | unit_id | amount | ...            │
└────────────┬────────────────────────────┘
             │ 1:N
             │
    ┌────────┴────────┬────────────┬────────────┐
    │                 │            │            │
    ▼                 ▼            ▼            ▼
┌───────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐
│ Penalty   │  │ Base Fee   │  │ Category │  │ Category │
│           │  │            │  │    1     │  │    2     │
│ Record 1  │  │  Record 2  │  │ Record 3 │  │ Record 4 │
│ amount=250│  │ amount=2000│  │ amt=100  │  │ amt=100  │
└─────┬─────┘  └────────────┘  └──────┬───┘  └────┬─────┘
      │                               │           │
      ▼                               ▼           ▼
┌──────────────────┐      ┌──────────────────┐ ┌──────────────────┐
│ PenaltyWaiver    │      │ BillCategory 1   │ │ BillCategory 2   │
│ (waived_amount)  │      │ (Maintenance)    │ │ (Cleaning)       │
└──────────────────┘      └──────────────────┘ └──────────────────┘


┌─────────────────────────────────────┐
│ service_fee_payment_detail (CHILD)  │
│                                     │
│ Links main payment to components    │
│ Tracks what was paid & how much     │
└─────────────────────────────────────┘
```

---

## Key Points

✅ **One Record Per Item**
- Penalty: 1 record
- Base Fee: 1 record
- Each Bill Category: 1 record
- **Total:** 1 + 1 + N (bill categories)

✅ **Hierarchy is Strict**
- Penalty MUST be paid first
- Base fee paid after penalty
- Categories paid after base fee
- Excess becomes AdvancePayment (separate table)

✅ **Foreign Keys**
- `service_fee_payment_id`: Links to main payment
- `service_fee_billing_id`: Links to billing record
- `penalty_waiver_id`: Optional (for penalty records)
- `bill_category_id`: Optional (for bill category records)

✅ **Queryable**
```python
# Get all penalty payments
penalties = ServiceFeePaymentDetail.objects.filter(payment_type='penalty')

# Get all base fee payments
base_fees = ServiceFeePaymentDetail.objects.filter(payment_type='base_fee')

# Get bill category payments
categories = ServiceFeePaymentDetail.objects.filter(payment_type='bill_category')

# Get payment breakdown for specific payment
payment = ServiceFeePayment.objects.get(id=1)
details = payment.payment_details.all()
```

---

## Migration Status

✅ **Model:** Created in `/backend/service_fee_management/models.py` (lines 1180-1260)
✅ **Migration File:** Created `/backend/service_fee_management/migrations/0089_servicefeepaymentdetail.py`
⏳ **Next Step:** Apply migration with `python manage.py migrate service_fee_management`
