# Payment Detail Duplicate Prevention Logic

## Problem

When recording a payment with multiple items:
- One transaction = multiple detail records (penalty, base_fee, categories)
- **Issue:** If same item is paid again in same transaction → duplicate records created
- **Solution:** Check for existing records before saving

---

## Duplicate Prevention Rules

### Rule 1: Penalty - Only ONE per Payment
```python
# ❌ WRONG: Creates duplicates
ServiceFeePaymentDetail.objects.create(
    service_fee_payment_id=1,
    payment_type='penalty',
    amount_paid=250
)
# If penalty already exists for this payment → DUPLICATE!

# ✅ CORRECT: Check first
existing_penalty = ServiceFeePaymentDetail.objects.filter(
    service_fee_payment_id=1,
    payment_type='penalty'
).exists()

if not existing_penalty:
    ServiceFeePaymentDetail.objects.create(
        service_fee_payment_id=1,
        payment_type='penalty',
        amount_paid=250
    )
```

---

### Rule 2: Base Fee - Only ONE per Payment
```python
# ✅ CHECK BEFORE SAVING
existing_base_fee = ServiceFeePaymentDetail.objects.filter(
    service_fee_payment_id=1,
    payment_type='base_fee'
).exists()

if not existing_base_fee:
    ServiceFeePaymentDetail.objects.create(
        service_fee_payment_id=1,
        payment_type='base_fee',
        amount_paid=2000
    )
```

---

### Rule 3: Bill Categories - ONE per Category per Payment
```python
# ❌ WRONG: Multiple records for same category
for category in categories:
    ServiceFeePaymentDetail.objects.create(
        service_fee_payment_id=1,
        payment_type='bill_category',
        bill_category_id=1,  # Same category!
        amount_paid=100
    )
# Creates DUPLICATE if category 1 already has record

# ✅ CORRECT: Check by payment + category
for category in categories:
    existing = ServiceFeePaymentDetail.objects.filter(
        service_fee_payment_id=1,
        payment_type='bill_category',
        bill_category_id=category.id  # CHECK THIS COMBINATION
    ).exists()
    
    if not existing:
        ServiceFeePaymentDetail.objects.create(
            service_fee_payment_id=1,
            payment_type='bill_category',
            bill_category_id=category.id,
            amount_paid=100
        )
```

---

## Implementation Pattern

### Option 1: Check Existence Before Create
```python
def create_payment_detail(payment_id, payment_type, bill_category_id=None, amount=0):
    """
    Create payment detail record if not already exists
    Prevents duplicates
    """
    # Build filter criteria
    filter_dict = {
        'service_fee_payment_id': payment_id,
        'payment_type': payment_type
    }
    
    # Add bill_category for category records
    if payment_type == 'bill_category' and bill_category_id:
        filter_dict['bill_category_id'] = bill_category_id
    
    # Check if already exists
    if ServiceFeePaymentDetail.objects.filter(**filter_dict).exists():
        print(f"⚠️  Duplicate detected: payment_id={payment_id}, type={payment_type}")
        return None  # Don't create
    
    # Create if not exists
    detail = ServiceFeePaymentDetail.objects.create(
        service_fee_payment_id=payment_id,
        service_fee_billing_id=billing_id,
        payment_type=payment_type,
        bill_category_id=bill_category_id,
        amount_paid=amount
    )
    return detail
```

**Usage:**
```python
# Penalty (max 1 per payment)
create_payment_detail(
    payment_id=1,
    payment_type='penalty',
    amount=250
)

# Base Fee (max 1 per payment)
create_payment_detail(
    payment_id=1,
    payment_type='base_fee',
    amount=2000
)

# Categories (1 per category per payment)
for category in categories:
    create_payment_detail(
        payment_id=1,
        payment_type='bill_category',
        bill_category_id=category.id,
        amount=100
    )
```

---

### Option 2: Use get_or_create()
```python
from django.db.models import F

detail, created = ServiceFeePaymentDetail.objects.get_or_create(
    service_fee_payment_id=payment_id,
    payment_type='penalty',  # Unique combination
    defaults={
        'service_fee_billing_id': billing_id,
        'amount_paid': 250,
        'penalty_waiver_id': waiver_id
    }
)

if created:
    print(f"✅ Created new penalty detail: id={detail.id}")
else:
    print(f"⚠️  Penalty detail already exists: id={detail.id}")
```

---

### Option 3: Update if Exists, Create if Not
```python
detail, created = ServiceFeePaymentDetail.objects.update_or_create(
    service_fee_payment_id=payment_id,
    payment_type='penalty',
    defaults={
        'service_fee_billing_id': billing_id,
        'amount_paid': 250,  # Update amount if exists
        'penalty_waiver_id': waiver_id
    }
)

if created:
    print(f"✅ Created penalty detail")
else:
    print(f"🔄 Updated existing penalty detail")
```

---

## Complete Payment Recording with Duplicate Prevention

```python
def record_payment_with_items(payment_id, items):
    """
    Record payment and create detail records (no duplicates)
    """
    from django.db import transaction
    
    with transaction.atomic():
        payment = ServiceFeePayment.objects.get(id=payment_id)
        billing = ServiceFeeBilling.objects.get(servicefeepaymentid=payment)
        
        remaining = Decimal(str(payment.amount))
        
        # Step 1: Penalty (max 1)
        if remaining > 0:
            detail, created = ServiceFeePaymentDetail.objects.get_or_create(
                service_fee_payment_id=payment_id,
                payment_type='penalty',
                defaults={
                    'service_fee_billing_id': billing.id,
                    'amount_paid': min(remaining, Decimal('250')),
                    'penalty_waiver_id': items.get('penalty_waiver_id')
                }
            )
            if created:
                print(f"✅ Created penalty detail: {detail.id}")
                remaining -= detail.amount_paid
            else:
                print(f"⚠️  Penalty detail already exists: {detail.id}")
        
        # Step 2: Base Fee (max 1)
        if remaining > 0:
            detail, created = ServiceFeePaymentDetail.objects.get_or_create(
                service_fee_payment_id=payment_id,
                payment_type='base_fee',
                defaults={
                    'service_fee_billing_id': billing.id,
                    'amount_paid': min(remaining, Decimal('2000'))
                }
            )
            if created:
                print(f"✅ Created base_fee detail: {detail.id}")
                remaining -= detail.amount_paid
            else:
                print(f"⚠️  Base fee detail already exists: {detail.id}")
        
        # Step 3: Bill Categories (1 per category)
        if remaining > 0:
            for category in items.get('categories', []):
                detail, created = ServiceFeePaymentDetail.objects.get_or_create(
                    service_fee_payment_id=payment_id,
                    payment_type='bill_category',
                    bill_category_id=category['id'],
                    defaults={
                        'service_fee_billing_id': billing.id,
                        'amount_paid': min(remaining, Decimal(str(category['amount'])))
                    }
                )
                if created:
                    print(f"✅ Created category detail: {detail.id}")
                    remaining -= detail.amount_paid
                else:
                    print(f"⚠️  Category detail already exists: {detail.id}")
        
        # Step 4: Excess (separate table)
        if remaining > 0:
            AdvancePayment.objects.create(
                unit_id=payment.unit_id,
                resident=payment.resident,
                advance_type='auto_excess',
                amount=remaining,
                source_payment_id=payment_id
            )
            print(f"✅ Created advance payment: {remaining} TK")
```

---

## Database Uniqueness Constraints

### Option: Add Unique Constraints
```python
class ServiceFeePaymentDetail(models.Model):
    # ... existing fields ...
    
    class Meta:
        db_table = 'service_fee_payment_detail'
        constraints = [
            # Penalty: max 1 per payment
            UniqueConstraint(
                fields=['service_fee_payment', 'payment_type'],
                condition=Q(payment_type='penalty'),
                name='unique_penalty_per_payment'
            ),
            # Base Fee: max 1 per payment
            UniqueConstraint(
                fields=['service_fee_payment', 'payment_type'],
                condition=Q(payment_type='base_fee'),
                name='unique_base_fee_per_payment'
            ),
            # Categories: 1 per category per payment
            UniqueConstraint(
                fields=['service_fee_payment', 'payment_type', 'bill_category'],
                condition=Q(payment_type='bill_category'),
                name='unique_category_per_payment'
            ),
        ]
```

**Benefit:** Database enforces uniqueness automatically

---

## Testing Duplicate Prevention

```python
# Test 1: Creating same penalty twice
detail1 = create_payment_detail(payment_id=1, payment_type='penalty', amount=250)
detail2 = create_payment_detail(payment_id=1, payment_type='penalty', amount=250)

assert detail1 is not None  # First created
assert detail2 is None      # Second NOT created (duplicate prevented)

# Test 2: Different categories allowed
detail3 = create_payment_detail(payment_id=1, payment_type='bill_category', bill_category_id=1, amount=100)
detail4 = create_payment_detail(payment_id=1, payment_type='bill_category', bill_category_id=2, amount=100)

assert detail3 is not None  # Category 1 created
assert detail4 is not None  # Category 2 created (different category)

# Test 3: Same category twice - prevented
detail5 = create_payment_detail(payment_id=1, payment_type='bill_category', bill_category_id=1, amount=100)

assert detail5 is None  # Duplicate of category 1 prevented
```

---

## Summary

**One Transaction = Multiple Items:**
```
Payment 1 (4500 TK)
├── Penalty = 250 TK (1 record max) ✅
├── Base Fee = 2000 TK (1 record max) ✅
├── Category 1 = 100 TK (1 per category) ✅
├── Category 2 = 100 TK (1 per category) ✅
└── Category 3 = 100 TK (1 per category) ✅
```

**NO DUPLICATES:**
- Penalty: Only 1 per payment
- Base Fee: Only 1 per payment
- Categories: Only 1 per category per payment

**Prevention Methods:**
1. ✅ Check existence before create
2. ✅ Use `get_or_create()`
3. ✅ Use `update_or_create()`
4. ✅ Add database constraints
