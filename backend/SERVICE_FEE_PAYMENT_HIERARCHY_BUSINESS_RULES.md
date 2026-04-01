# Service Fee Payment Hierarchy - Business Rules & Implementation

## 1. Business Rules

### Payment Priority Order

When a resident makes a payment, the system MUST allocate the payment amount according to this STRICT hierarchy:

#### **STEP 1: PENALTY (Late Fee) - PAID FIRST**
- **Rule:** Late fee penalty MUST be paid before any other charge
- **Calculation:** `net_penalty = gross_penalty_amount - waived_amount`
- **Condition:** Only if `net_penalty > 0`
- **Table:** `ServiceFeePenaltyWaiver` records the penalty details
- **Tracking:** `ServiceFeePaymentDetail` with `payment_type='penalty'`

**Example:**
```
Gross Penalty: 250 TK
Waived Amount: 0 TK
Net Penalty: 250 TK (MUST PAY FIRST)
```

---

#### **STEP 2: BASE FEE - PAID SECOND**
- **Rule:** Original service fee amount is paid after penalty
- **Calculation:** `amount_owed = original_fixed_amount - already_paid`
- **Condition:** Only if `amount_owed > 0`
- **Table:** `ServiceFeePayment.base_service_amount` stores the base fee
- **Tracking:** `ServiceFeePaymentDetail` with `payment_type='base_fee'`

**Example:**
```
Original Amount: 2000 TK
Already Paid: 500 TK
Amount Owed: 1500 TK (PAY SECOND)
```

---

#### **STEP 3: BILL CATEGORIES - PAID THIRD**
- **Rule:** Utility items (electricity, water, etc.) are paid LAST
- **Calculation:** Distributed equally across all categories (or per-category if specified)
- **Condition:** Only if `total_bill_category_amount > 0` AND payment still available
- **Table:** `ServiceFeeBillCategory` contains category details
- **Tracking:** `ServiceFeePaymentDetail` with `payment_type='bill_category'` (ONE record per category)

**Important:** Each bill category gets its OWN payment detail record:
```
Category 1 (Maintenance): 100 TK → Record 1
Category 2 (Cleaning): 100 TK → Record 2
Category 3 (Water): 100 TK → Record 3
```

---

#### **STEP 4: EXCESS AMOUNT - BECOMES ADVANCE PAYMENT**
- **Rule:** Any remaining amount after all payments becomes advance credit
- **Calculation:** `excess = payment_amount - (penalty + base_fee + bill_categories)`
- **Condition:** Only if `excess > 0`
- **Table:** `AdvancePayment` with `advance_type='auto_excess'`
- **Tracking:** NOT included in `ServiceFeePaymentDetail` (recorded separately)

**Example:**
```
Total Payment: 5000 TK
Penalty Paid: 250 TK
Base Fee Paid: 2000 TK
Bill Categories Paid: 1500 TK
Excess: 250 TK → Saved as AdvancePayment
```

---

## 2. Database Schema & Relationships

### Main Tables Involved

#### **`service_fee_management_servicefeepayment`** (Parent)
```
Fields:
├── id (PK)
├── unit_id (FK → towers_unit)
├── resident_id (FK → user_member)
├── service_fee_id (FK → service_fee_servicefee)
├── service_period_month
├── service_period_year
├── base_service_amount (base fee amount)
├── additional_bill_charges (sum of bill categories)
├── amount (total payment received)
├── service_status (due|partial|paid|overdue)
├── payment_status (pending|completed|failed|cancelled|refunded)
└── ... audit fields
```

**Purpose:** Main payment transaction record

---

#### **`service_fee_payment_detail`** (Child - NEW)
```
Fields:
├── id (PK)
├── service_fee_payment_id (FK → service_fee_management_servicefeepayment)
├── service_fee_billing_id (FK → service_fee_payment_details)
├── payment_type (penalty | base_fee | bill_category)
├── amount_paid (Decimal - what was paid for this component)
├── penalty_waiver_id (FK → service_fee_penalty_waivers, NULL if not penalty)
├── bill_category_id (FK → bill_category, NULL if not bill_category)
├── description (TEXT - details about component)
└── created_at (DateTime)
```

**Purpose:** Track breakdown of each payment by component type

**Database Table Name:** `service_fee_payment_detail`

---

#### **`service_fee_penalty_waivers`** (Related)
```
Fields:
├── id (PK)
├── billing_id (FK → service_fee_payment_details)
├── waiver_type (full | partial_percentage | partial_fixed)
├── penalty_amount (gross penalty before waiver)
├── waived_amount (amount waived)
├── penalty_after_waiver (net penalty = gross - waived)
├── reason
├── notes
└── ... audit fields
```

**Purpose:** Track penalty waivers applied to billing

---

#### **`service_fee_bill_categories`** (Related)
```
Fields:
├── id (PK)
├── servicefeepaymentid_id (FK → service_fee_management_servicefeepayment)
├── bill_category_id (FK → bill_category)
├── unit_id (FK → towers_unit)
├── amount (decimal - category charge amount)
├── unit_of_measurement
├── price_per_unit
├── consumption
└── ... detail fields
```

**Purpose:** Store bill category charges for a payment

---

#### **`service_fee_advance_payments`** (Related)
```
Fields:
├── id (PK)
├── unit_id (FK → towers_unit)
├── resident_id (FK → user_member)
├── advance_type (auto_excess | service_fee_advance | other_advance)
├── amount (total advance held)
├── applied_amount (amount used)
├── remaining_amount (available balance)
├── source_payment_id (payment ID that created this advance)
├── status (available | partial | applied | cancelled)
└── ... audit fields
```

**Purpose:** Track overpayments held as credit for future months

---

## 3. Table Relationships Diagram

```
┌─────────────────────────────────────────┐
│ service_fee_management_servicefeepayment│
│ (Main Payment Transaction)              │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ unit_id, service_period_month/year      │
│ base_service_amount, amount             │
└────────────┬────────────────────────────┘
             │ 1:N (one payment → many components)
             │
    ┌────────┴─────────┬──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│Penalty (1)  │  │Base Fee (1)  │  │Bill Categories
│             │  │              │  │(1 per category)
│FK: payment_ │  │ FK: payment_ │  │ FK: payment_
│     detail  │  │      detail  │  │      detail
└─────────────┘  └──────────────┘  └──────────────┘
        │
        ▼
┌──────────────────────┐
│ PenaltyWaiver        │
│ (Penalty Details)    │
└──────────────────────┘


From service_fee_payment_detail:
├─ Penalty → PenaltyWaiver (optional FK)
├─ BillCategory → bill_category (optional FK)
└─ BillingRecord → service_fee_payment_details (FK)


After all steps:
If excess_amount > 0:
    ▼
┌──────────────────────┐
│ AdvancePayment       │
│ (auto_excess type)   │
└──────────────────────┘
```

---

## 4. Implementation: Models

### Already Implemented in `models.py`:

#### **ServiceFeePaymentDetail** (Lines 1180-1260)
```python
class ServiceFeePaymentDetail(models.Model):
    """
    Model to track breakdown of each payment
    Records what components were paid: penalty, base fee, bill categories
    """
    PAYMENT_TYPE_CHOICES = [
        ('penalty', 'Penalty Payment'),
        ('base_fee', 'Base Service Fee'),
        ('bill_category', 'Bill Category Charge'),
    ]
    
    # Links to parent payment
    service_fee_payment = ForeignKey('ServiceFeePayment', ...)  # Parent payment
    service_fee_billing = ForeignKey('ServiceFeeBilling', ...)  # Billing record
    
    # What was paid
    payment_type = CharField(choices=PAYMENT_TYPE_CHOICES)  # penalty|base_fee|bill_category
    amount_paid = DecimalField(...)  # Amount for this component
    
    # Optional links to related records
    penalty_waiver = ForeignKey('PenaltyWaiver', null=True, blank=True)
    bill_category = ForeignKey('bill_categories.BillCategory', null=True, blank=True)
    
    # Metadata
    description = TextField(null=True, blank=True)
    created_at = DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'service_fee_payment_detail'
        ordering = ['created_at']
        indexes = [
            Index(fields=['service_fee_payment', 'payment_type']),
            Index(fields=['service_fee_billing']),
        ]
```

**Status:** ✅ ALREADY IN MODELS.PY

---

## 5. Payment Flow & Data Creation

### When Payment is Received

**Input from Frontend/API:**
```json
{
  "unit_id": 87,
  "service_fee_id": 5,
  "total_amount": 4500,
  "selected_periods": [
    {
      "service_period_month": 12,
      "service_period_year": 2025,
      "penalty_amount": 250,
      "waived_amount": 0,
      "new_waiver_data": [...]
    }
  ]
}
```

---

### Processing Steps in views.py

#### **Step 1: Create Main Payment Record**
```python
# Create ServiceFeePayment
payment = ServiceFeePayment.objects.create(
    unit_id=unit_id,
    service_fee_id=service_fee_id,
    service_period_month=12,
    service_period_year=2025,
    base_service_amount=2000,
    additional_bill_charges=200,
    amount=4500,  # Total input
    service_status='paid',
    payment_status='completed'
)
```

---

#### **Step 2: Create Billing Record**
```python
# Create ServiceFeeBilling
billing = ServiceFeeBilling.objects.create(
    servicefeepaymentid=payment,
    billing_amount=2200,  # base + charges
    total_paid=4500,
    payment_date=now(),
    # ... other fields
)
```

---

#### **Step 3: Create Payment Detail Records (Hierarchy)**

**Initialize tracking:**
```python
remaining_amount = Decimal('4500')  # Total payment input

# STEP 1: Pay Penalty
penalty_net = Decimal('250') - Decimal('0')  # 250 - 0 = 250
if penalty_net > 0:
    ServiceFeePaymentDetail.objects.create(
        service_fee_payment=payment,
        service_fee_billing=billing,
        payment_type='penalty',
        amount_paid=penalty_net,
        penalty_waiver=waiver_record,
        description='Late payment penalty'
    )
    remaining_amount -= penalty_net  # 4500 - 250 = 4250

# STEP 2: Pay Base Fee
base_fee_owed = Decimal('2000')  # Original amount
if base_fee_owed > 0:
    base_fee_paid = min(remaining_amount, base_fee_owed)  # min(4250, 2000) = 2000
    ServiceFeePaymentDetail.objects.create(
        service_fee_payment=payment,
        service_fee_billing=billing,
        payment_type='base_fee',
        amount_paid=base_fee_paid,
        description='Base service fee'
    )
    remaining_amount -= base_fee_paid  # 4250 - 2000 = 2250

# STEP 3: Pay Bill Categories (ONE record PER category)
categories = [
    {'id': 1, 'name': 'Maintenance', 'amount': 100},
    {'id': 2, 'name': 'Cleaning', 'amount': 100},
]
per_category_amount = Decimal('200') / 2  # 100 each

for category in categories:
    if remaining_amount > 0:
        category_paid = min(remaining_amount, per_category_amount)
        ServiceFeePaymentDetail.objects.create(
            service_fee_payment=payment,
            service_fee_billing=billing,
            payment_type='bill_category',
            amount_paid=category_paid,
            bill_category=category,
            description=f'{category["name"]}: {category_paid} TK'
        )
        remaining_amount -= category_paid  # 2250 - 100 = 2150, etc.

# STEP 4: Handle Excess
if remaining_amount > 0:
    AdvancePayment.objects.create(
        unit_id=unit_id,
        resident=resident,
        advance_type='auto_excess',
        amount=remaining_amount,
        source_payment_id=payment.id
    )
    # remaining_amount is NOT added to payment_details
```

---

### Payment Detail Records Created (for example above):

```
Record 1: type='penalty', amount=250
Record 2: type='base_fee', amount=2000
Record 3: type='bill_category', amount=100 (Category 1)
Record 4: type='bill_category', amount=100 (Category 2)
Record 5: AdvancePayment created (not in payment_details)
```

---

## 6. Querying Payment Details

### Get All Components of a Payment:
```python
payment = ServiceFeePayment.objects.get(id=123)
details = payment.payment_details.all()

# Grouped by type
penalties = payment.payment_details.filter(payment_type='penalty')
base_fees = payment.payment_details.filter(payment_type='base_fee')
bill_categories = payment.payment_details.filter(payment_type='bill_category')
```

### Calculate Total Paid by Component:
```python
from django.db.models import Sum

payment = ServiceFeePayment.objects.get(id=123)

penalty_total = payment.payment_details.filter(
    payment_type='penalty'
).aggregate(total=Sum('amount_paid'))['total'] or 0

base_fee_total = payment.payment_details.filter(
    payment_type='base_fee'
).aggregate(total=Sum('amount_paid'))['total'] or 0

bill_category_total = payment.payment_details.filter(
    payment_type='bill_category'
).aggregate(total=Sum('amount_paid'))['total'] or 0
```

---

## 7. API Response Structure

### Example: GET /api/service-fee-management/unpaid-periods/

```json
{
  "success": true,
  "data": {
    "unpaid_periods": [
      {
        "service_period_month": 12,
        "service_period_year": 2025,
        "month_name": "December 2025",
        "original_amount": "2000",
        "bill_category_amount": "200",
        "paid_amount": "0",
        "gross_penalty_amount": "250",
        "penalty_amount": "250",
        "waived_amount": "0",
        "due_amount": "2450",
        "due_date": "2025-12-10",
        "service_status": "overdue",
        
        // NEW: Payment Hierarchy Breakdown
        "payment_hierarchy": {
          "step_1_penalty": {
            "type": "penalty",
            "gross_amount": "250",
            "waived_amount": "0",
            "net_amount": "250",
            "description": "Late payment penalty (after waiver)"
          },
          "step_2_base_fee": {
            "type": "base_fee",
            "amount": "2000",
            "already_paid": "0",
            "remaining": "2000",
            "description": "Original service fee"
          },
          "step_3_bill_categories": {
            "type": "bill_categories",
            "total_amount": "200",
            "categories": [
              {
                "id": 1,
                "name": "Maintenance Charge",
                "amount": "100"
              },
              {
                "id": 2,
                "name": "Cleaning Fee",
                "amount": "100"
              }
            ],
            "description": "Additional bill category charges"
          },
          "step_4_total_due": {
            "type": "total",
            "penalty": "250",
            "base_fee": "2000",
            "bill_categories": "200",
            "total": "2450",
            "description": "Total amount due (Penalty + Base Fee + Categories)"
          }
        }
      }
    ]
  }
}
```

---

## 8. Data Integrity Rules

✅ **Hierarchy is Strict:**
- Penalty MUST be paid before base fee
- Base fee MUST be paid before bill categories
- Bill categories MUST be paid before excess becomes advance

✅ **One Record Per Bill Category:**
- If 3 bill categories exist, 3 separate `ServiceFeePaymentDetail` records are created
- Each record is independently queryable

✅ **Foreign Keys:**
- `ServiceFeePaymentDetail.service_fee_payment` → Links to main payment
- `ServiceFeePaymentDetail.service_fee_billing` → Links to billing record
- `ServiceFeePaymentDetail.penalty_waiver` → Optional, for penalty records
- `ServiceFeePaymentDetail.bill_category` → Optional, for bill category records

✅ **Status Consistency:**
- `service_status` updated based on total paid vs required
- `payment_status` marks when payment is completed
- `AdvancePayment.status` tracks application of excess

---

## 9. Implementation Checklist

- [x] `ServiceFeePaymentDetail` model added to models.py (Lines 1180-1260)
- [ ] Create migration: `python manage.py makemigrations service_fee_management`
- [ ] Apply migration: `python manage.py migrate`
- [ ] Implement in views.py: Payment recording endpoint (lines 1501-1878)
  - [ ] Step 1: Create main payment record
  - [ ] Step 2: Create billing record
  - [ ] Step 3: Create payment detail records (hierarchy logic)
  - [ ] Step 4: Create AdvancePayment if excess > 0
- [ ] Create serializer for `ServiceFeePaymentDetail`
- [ ] Update API responses to include payment hierarchy
- [ ] Update frontend to display payment breakdown
- [ ] Write unit tests for hierarchy logic
- [ ] Update API documentation

---

## 10. Key Files

**Models:**
- `h:/wamp64/www/estate-link/backend/service_fee_management/models.py`
  - `ServiceFeePayment` (Line 195)
  - `ServiceFeeBilling` (Line 11)
  - `ServiceFeePaymentDetail` (Line 1180) ✅ NEW
  - `PenaltyWaiver` (Line 129)
  - `AdvancePayment` (Line 1091)
  - `ServiceFeeBillCategory` (Line 1044)

**Views:**
- `h:/wamp64/www/estate-link/backend/service_fee_management/views.py`
  - `ServiceFeeMultiMonthPaymentView` - Main payment recording endpoint
  - `ServiceFeeUnpaidPeriodsView` - GET unpaid periods with hierarchy
  - `BillingDetailedListView` - GET billing details with breakdown

**Migrations:**
- Auto-generated: `service_fee_management/migrations/00XX_servicefeeipaymentdetail.py`

---

## Summary

**Business Rule:** Payment hierarchy (Penalty → Base Fee → Bill Categories → Excess Advance)

**Implementation:** 
- Parent: `service_fee_management_servicefeepayment` (main payment)
- Child: `service_fee_payment_detail` (component breakdown)
- Related: `service_fee_penalty_waivers`, `service_fee_bill_categories`, `service_fee_advance_payments`

**Result:** Complete audit trail showing exactly what components were paid and in what order.

