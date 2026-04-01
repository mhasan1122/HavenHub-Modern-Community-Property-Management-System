# Service Fee Payment Detail Implementation

## Overview
Add a new `ServiceFeePaymentDetail` model to track the breakdown of each payment, recording what components were paid (penalty, base fee, bill categories).

## Database Schema

### New Model: `ServiceFeePaymentDetail`
**Table Name:** `service_fee_payment_detail`

#### Fields:

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | Auto | Primary Key | Auto-generated |
| `service_fee_payment_id` | ForeignKey | Link to `ServiceFeePayment` | CASCADE delete |
| `service_fee_billing_id` | ForeignKey | Link to `ServiceFeeBilling` | CASCADE delete |
| `payment_type` | CharField(20) | Type of payment: `penalty`, `base_fee`, `bill_category` | Required, Choices |
| `amount_paid` | DecimalField(10,2) | Amount paid for this component | Min: 0, Required |
| `penalty_waiver_id` | ForeignKey | Link to `PenaltyWaiver` (if applicable) | NULL, BLANK, SET_NULL |
| `bill_category_id` | ForeignKey | Link to `BillCategory` (if applicable) | NULL, BLANK, SET_NULL |
| `description` | TextField | Details about payment component | NULL, BLANK |
| `created_at` | DateTimeField | Timestamp | auto_now_add |

#### Relationships:

```
ServiceFeePaymentDetail (Many)
    ├─→ ServiceFeePayment (One)
    ├─→ ServiceFeeBilling (One)
    ├─→ PenaltyWaiver (Zero or One) [if payment_type = 'penalty']
    └─→ BillCategory (Zero or One) [if payment_type = 'bill_category']
```

#### Indexes:
- `(service_fee_payment, payment_type)` - For quick lookup by payment and type
- `(service_fee_billing)` - For quick lookup by billing record

## Implementation Steps

### Step 1: Model Definition ✅
**Status:** COMPLETED
**File:** `service_fee_management/models.py`
**What was added:**
- `ServiceFeePaymentDetail` class with all required fields
- Choice field for `payment_type`
- Foreign keys to related models
- Meta configuration with indexes
- `__str__` method

### Step 2: Create Migration (Next)
**Command:**
```bash
cd backend
python manage.py makemigrations service_fee_management
python manage.py migrate service_fee_management
```

**Expected Output:**
- New migration file: `service_fee_management/migrations/00XX_servicefeeipaymentdetail.py`
- Creates `service_fee_payment_detail` table
- Adds foreign key constraints

### Step 3: Update Payment Recording View
**File:** `service_fee_management/views.py`
**Changes needed:**
- In the payment loop (lines 1501-1876), add payment detail creation
- Loop through payment components:
  1. **Penalty Payment** (if `penalty_amount > 0` or `waived_amount > 0`)
  2. **Base Fee Payment** (always)
  3. **Bill Category Payments** (if additional charges exist)
- Create `ServiceFeePaymentDetail` record for each component

### Step 4: Implementation in Views.py

#### Location: After billing record creation (around line 1669)

```python
# After billing.calculate_totals() at line 1669

# Create payment detail records
try:
    # 1. Create base fee payment detail
    ServiceFeePaymentDetail.objects.create(
        service_fee_payment=payment,
        service_fee_billing=billing,
        payment_type='base_fee',
        amount_paid=Decimal(str(min(payment_amount, original_fixed_amount))),
        description=f'Base service fee payment for {datetime(service_period_year, service_period_month, 1).strftime("%B %Y")}'
    )
    
    # 2. Create penalty payment detail (if applicable)
    if penalty_amount_req > 0 or waived_amount_req > 0:
        # Find or create waiver record
        waiver = PenaltyWaiver.objects.filter(billing=billing).first()
        ServiceFeePaymentDetail.objects.create(
            service_fee_payment=payment,
            service_fee_billing=billing,
            payment_type='penalty',
            amount_paid=penalty_amount_req - waived_amount_req,
            penalty_waiver=waiver,
            description=f'Penalty payment (Waived: {waived_amount_req}) for {datetime(service_period_year, service_period_month, 1).strftime("%B %Y")}'
        )
    
    # 3. Create bill category payment details (if applicable)
    # IMPORTANT: Create ONE payment detail record for EACH bill category
    bill_categories = existing_payment.bill_categories.all()  # Assuming M2M or FK exists
    if bill_categories.exists():
        category_charges = existing_payment.additional_bill_charges or Decimal('0')
        # Distribute total charges equally across categories
        per_category_amount = category_charges / len(bill_categories)
        
        for category in bill_categories:
            # Create separate record for EACH category
            ServiceFeePaymentDetail.objects.create(
                service_fee_payment=payment,
                service_fee_billing=billing,
                payment_type='bill_category',
                amount_paid=per_category_amount,
                bill_category=category,
                description=f'{category.name}: {per_category_amount} TK'
            )
            
except Exception as e:
    print(f"⚠️  Error creating payment details: {str(e)}")
    # Don't fail the payment operation if detail creation fails
```

## Payment Type Hierarchy Logic

### Payment Allocation Order (Priority):

```
┌─────────────────────────────────────────────────────┐
│     TOTAL PAYMENT AMOUNT RECEIVED                    │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │ STEP 1: PAY PENALTY│
         │ (if exists)       │
         │ ─────────────────│
         │ Net Penalty =     │
         │ Penalty - Waived  │
         └─────────┬─────────┘
                   │
         ┌─────────▼──────────────┐
         │ STEP 2: PAY BASE FEE   │
         │ ─────────────────────  │
         │ Amount = Original Fee  │
         │ Already Paid Subtracted│
         └─────────┬──────────────┘
                   │
         ┌─────────▼──────────────────────┐
         │ STEP 3: PAY BILL CATEGORIES    │
         │ ─────────────────────────────  │
         │ Amount = Additional Charges    │
         │ Distribute if multiple exist   │
         └─────────┬──────────────────────┘
                   │
         ┌─────────▼─────────────┐
         │ STEP 4: EXCESS AMOUNT │
         │ ─────────────────────│
         │ If Amount > 0        │
         │ → AdvancePayment     │
         └───────────────────────┘
```

### Detailed Hierarchy Algorithm:

```python
remaining_amount = total_payment_input

# STEP 1: Pay Penalty First (if applicable)
if penalty_amount > 0:
    penalty_net = penalty_amount - waived_amount
    if penalty_net > 0:
        penalty_paid = min(remaining_amount, penalty_net)
        remaining_amount -= penalty_paid
        
        # Record: payment_type='penalty', amount_paid=penalty_paid
        Create ServiceFeePaymentDetail(
            payment_type='penalty',
            amount_paid=penalty_paid,
            penalty_waiver=waiver_record
        )

# STEP 2: Pay Base Service Fee (always)
base_fee_owed = original_fixed_amount - already_paid_for_base
if base_fee_owed > 0:
    base_fee_paid = min(remaining_amount, base_fee_owed)
    remaining_amount -= base_fee_paid
    
    # Record: payment_type='base_fee', amount_paid=base_fee_paid
    Create ServiceFeePaymentDetail(
        payment_type='base_fee',
        amount_paid=base_fee_paid
    )

# STEP 3: Pay Bill Categories (if applicable)
if additional_charges > 0 and remaining_amount > 0:
    categories = get_bill_categories_for_payment()
    if len(categories) > 0:
        per_category_amount = additional_charges / len(categories)
        
        for category in categories:
            category_owed = per_category_amount - category_already_paid
            if category_owed > 0 and remaining_amount > 0:
                category_paid = min(remaining_amount, category_owed)
                remaining_amount -= category_paid
                
                # Record: payment_type='bill_category', amount_paid=category_paid
                Create ServiceFeePaymentDetail(
                    payment_type='bill_category',
                    amount_paid=category_paid,
                    bill_category=category
                )

# STEP 4: Handle Excess as Advance Payment
if remaining_amount > 0:
    Create AdvancePayment(
        unit_id=unit_id,
        resident=resident,
        advance_type='auto_excess',
        amount=remaining_amount,
        source_payment_id=payment.id
    )
```

### Example Scenario:

**Input:**
- Total Payment: 5000 TK
- Base Fee: 2500 TK
- Penalty: 300 TK (Waived: 100 TK) → Net: 200 TK
- Bill Categories: 1500 TK (3 categories × 500 each)

**Distribution:**
```
5000 TK
  ├─ 200 TK → Penalty (300 - 100 waived) ✓
  │   remaining: 4800 TK
  │
  ├─ 2500 TK → Base Fee ✓
  │   remaining: 2300 TK
  │
  ├─ 1500 TK → Bill Categories (500 + 500 + 500) ✓
  │   remaining: 800 TK
  │
  └─ 800 TK → AdvancePayment (auto_excess) ✓
     remaining: 0 TK
```

**Payment Details Created:**
1. `ServiceFeePaymentDetail(type='penalty', amount=200, penalty_waiver_id=X)`
2. `ServiceFeePaymentDetail(type='base_fee', amount=2500)`
3. `ServiceFeePaymentDetail(type='bill_category', amount=500, bill_category_id=1)` ← Category 1
4. `ServiceFeePaymentDetail(type='bill_category', amount=500, bill_category_id=2)` ← Category 2
5. `ServiceFeePaymentDetail(type='bill_category', amount=500, bill_category_id=3)` ← Category 3

**Total Payment Details Records: 5**
- 1 Penalty record
- 1 Base Fee record
- 3 Bill Category records (one for EACH category)

**Advance Payment Created:**
- `AdvancePayment(amount=800, advance_type='auto_excess', source_payment_id=Y)`

### Key Rules:

1. ✅ **Penalty paid FIRST** (after waiver deduction)
2. ✅ **Base Fee paid SECOND** (only owed amount)
3. ✅ **Bill Categories paid THIRD** (distributed equally or per category)
4. ✅ **Excess becomes Advance** (for future use)
5. ✅ **Track in payment_details** (each component recorded)
6. ✅ **Cannot go negative** (min() check for each step)

### Status Determination:

```
AFTER payment_details created:

if total_paid_all_components >= original_fixed_amount:
    service_status = 'paid'
    payment_status = 'completed'
elif total_paid_base_fee > 0:
    service_status = 'partial'
    payment_status = 'pending'
else:
    service_status = 'due'
    payment_status = 'pending'
```

## Database Tables Involved

| Table | Purpose |
|-------|---------|
| `service_fee_payment_detail` | NEW - Payment breakdown |
| `service_fee_management_servicefeepayment` | Parent payment record |
| `service_fee_payment_details` | Billing records |
| `service_fee_penalty_waivers` | Penalty waivers |
| `service_fee_bill_categories` | Bill categories |

## API Response Example

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 123,
        "amount": "4000",
        "payment_details": [
          {
            "id": 1,
            "payment_type": "base_fee",
            "amount_paid": "2500",
            "description": "Base service fee payment for December 2025"
          },
          {
            "id": 2,
            "payment_type": "penalty",
            "amount_paid": "250",
            "penalty_waiver": {
              "id": 45,
              "waived_amount": "125",
              "reason": "Late payment discount"
            }
          },
          {
            "id": 3,
            "payment_type": "bill_category",
            "amount_paid": "1250",
            "bill_category": {
              "id": 5,
              "name": "Maintenance Charge"
            }
          }
        ]
      }
    ]
  }
}
```

## Query Examples

### Get all payment details for a payment:
```python
payment = ServiceFeePayment.objects.get(id=123)
details = payment.payment_details.all()

# Grouped by type
penalty_details = payment.payment_details.filter(payment_type='penalty')
fee_details = payment.payment_details.filter(payment_type='base_fee')
category_details = payment.payment_details.filter(payment_type='bill_category')
```

### Get payment breakdown for a billing record:
```python
billing = ServiceFeeBilling.objects.get(id=456)
details = billing.payment_details.all()
total_paid = details.aggregate(Sum('amount_paid'))['amount_paid__sum']
```

### Get penalties paid for specific period:
```python
from django.db.models import Sum
penalty_amount = ServiceFeePaymentDetail.objects.filter(
    payment_type='penalty',
    service_fee_payment__service_period_month=12,
    service_fee_payment__service_period_year=2025
).aggregate(Sum('amount_paid'))['amount_paid__sum']
```

## Testing Checklist

- [ ] Migration creates table correctly
- [ ] Foreign key constraints work
- [ ] Payment detail records created during payment
- [ ] Correct amounts recorded for each type
- [ ] Bill categories linked correctly
- [ ] Penalty waiver linked correctly
- [ ] Query aggregations work
- [ ] API response includes payment details
- [ ] Cascade delete works

## Benefits

✅ **Detailed Payment History** - Track exactly what was paid for each component
✅ **Better Reporting** - Aggregate payments by type (penalty, fee, categories)
✅ **Audit Trail** - Know which bill categories were paid for
✅ **Flexible Queries** - Easy to filter/search payments
✅ **API Enhancement** - Rich response with payment breakdown

## Migration Command

```bash
# In backend directory
python manage.py makemigrations service_fee_management
python manage.py migrate
```

## Files Modified

1. ✅ `service_fee_management/models.py` - Added `ServiceFeePaymentDetail` model
2. ⏳ `service_fee_management/migrations/XXXX_servicefeeipaymentdetail.py` - Auto-generated
3. ⏳ `service_fee_management/views.py` - Add detail creation in payment recording
4. ⏳ `service_fee_management/serializers.py` - Add `ServiceFeePaymentDetailSerializer`
