# Advance Payment Application - Implementation Summary

## Problem Statement
Previously, advance payments were being auto-applied during bill generation. However, this caused issues when:
1. An advance payment was made in December (৳50,000)
2. Bills were generated for January (৳32,920 advance shown but not applied)
3. The advance was not automatically adjusted against the generated bill

## Solution Overview
The advance payment application logic has been **separated from bill generation** and moved to a **dedicated trigger system** that activates when advance payments are recorded.

## Changes Made

### 1. Created New Utility Module
**File:** `backend/service_fee_management/utils/advance_payment_applicator.py`

- **Function:** `apply_advance_to_existing_bills(unit_id, account_holder_id, account_holder_type)`
- **Purpose:** Standalone function that applies available advances to existing unpaid bills
- **Features:**
  - FIFO (First-In-First-Out) advance application
  - Automatic status updates for advance records
  - Creates `ServiceFeeBilling` records with `payment_type='advance_payment'`
  - Updates bill payment status and remaining amounts
  - Comprehensive logging for debugging

### 2. Removed Auto-Apply from Bill Generation
**File:** `backend/service_fee_management/utils/service_fee_generator.py`

**Removed:**
- Lines 532-602: Auto-apply advance payment logic during bill generation
- Lines 906-934: Billing record creation for auto-applied advances

**Reason:** Advances should be applied when recorded, not during bill generation

### 3. Added Signal Handler
**File:** `backend/service_fee_management/signals.py`

**Added:** `apply_advance_on_billing_creation` signal handler

**Trigger:** Activates when a `ServiceFeeBilling` record is created with `payment_type='advance_payment'`

**Actions:**
1. Extracts unit and account holder information
2. Calls `apply_advance_to_existing_bills()` utility function
3. Logs results for monitoring

## How It Works Now

### Scenario: Recording an Advance Payment

1. **User Action:** Records a payment with `payment_type='advance_payment'`
   - Example: ৳50,000 advance payment for Unit B-101

2. **Database:** `ServiceFeeBilling` record is created with:
   ```python
   {
       'payment_type': 'advance_payment',
       'total_paid': 50000,
       'unit_id': 123,
       'account_holder_id': 456,
       'account_holder_type': 'owner'
   }
   ```

3. **Signal Trigger:** `apply_advance_on_billing_creation` signal fires

4. **Advance Application:**
   - Finds all available advances for Unit B-101, Owner 456
   - Finds all unpaid/partial bills for Unit B-101, Owner 456 (ordered by due date)
   - Applies advances to bills in FIFO order:
     ```
     December Bill: ৳18,080 → Apply ৳18,080 → Status: PAID
     January Bill: ৳32,920 → Apply ৳31,920 → Status: PAID
     Remaining Advance: ৳0
     ```

5. **Database Updates:**
   - Advance records: `status='depleted'`, `applied_amount` updated
   - Bill records: `total_paid` updated, `remaining_amount` updated, `payment_status='completed'`
   - New `ServiceFeeBilling` records created for each application

## Benefits

1. **Separation of Concerns:** Bill generation and advance application are independent
2. **Real-time Application:** Advances are applied immediately when recorded
3. **Transparency:** Each advance application creates a billing record for audit trail
4. **Flexibility:** Advances can be applied to any existing bills, not just newly generated ones
5. **Debugging:** Comprehensive logging makes it easy to track advance applications

## Testing Recommendations

### Test Case 1: Basic Advance Application
1. Generate a bill for January 2026 (৳32,920)
2. Record an advance payment of ৳50,000
3. **Expected:** Bill should be marked as PAID, remaining advance ৳17,080

### Test Case 2: Multiple Bills
1. Generate bills for January (৳32,920) and February (৳32,920)
2. Record an advance payment of ৳50,000
3. **Expected:** 
   - January bill: PAID
   - February bill: PARTIAL (৳17,080 paid, ৳15,840 remaining)
   - Remaining advance: ৳0

### Test Case 3: Existing Advance
1. Have an existing advance of ৳50,000 from December
2. Generate a bill for January (৳32,920)
3. Manually trigger advance application (or record another advance payment)
4. **Expected:** January bill should be automatically paid using existing advance

## Database Tables Affected

1. **`service_fee_advance_payments`**
   - `applied_amount` - increased when advance is applied
   - `remaining_amount` - decreased when advance is applied
   - `status` - updated to 'partial' or 'depleted'
   - `applied_at` - timestamp when fully depleted

2. **`service_fee_management_servicefeepayment`**
   - `total_paid` - increased by advance amount
   - `remaining_amount` - decreased by advance amount
   - `payment_status` - updated to 'completed' or 'partial'
   - `service_status` - updated to 'paid' or 'partial'

3. **`service_fee_payment_details`** (ServiceFeeBilling)
   - New records created with `payment_type='advance_payment'`
   - Tracks each advance application transaction

## Monitoring & Logs

Look for these log messages:
- `🔔 [Signal] Advance payment billing created for unit X, triggering auto-application`
- `💰 [Advance Application] Unit X: Found ৳Y in advance credits`
- `✅ Applied ৳X from Advance #Y`
- `✅ [Signal] Advance application completed: Applied ৳X to Y bill(s)`

## Rollback Plan

If issues occur, you can temporarily disable the signal by commenting out the `@receiver` decorator in `signals.py`:

```python
# @receiver(post_save, sender='service_fee_management.ServiceFeeBilling')
def apply_advance_on_billing_creation(sender, instance, created, **kwargs):
    ...
```

Then restart the Django server.
