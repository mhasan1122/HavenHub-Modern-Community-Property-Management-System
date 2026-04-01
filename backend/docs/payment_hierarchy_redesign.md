# Hierarchical Payment Architecture Redesign

## Overview
This document outlines the architectural changes required to implement a hierarchical payment system for Service Fees. The goal is to accurately track payment allocations against specific charge items (Service Fee, Late Fee, Utility Bills) rather than just broad categories, and to support prioritized partial payments.

## Core Concepts

### 1. ServiceFeeItem (The Liability)
Represents a specific "Line Item" on the invoice that needs to be paid.
*   **Source**: Created during Service Fee Generation or when a Late Fee is applied.
*   **Examples**: "Base Service Fee", "Late Fee (Jan)", "Water Bill (Jan)".
*   **Key Fields**: `amount` (Total Due), `item_type` (Priority identifier).

### 2. ServiceFeeBilling (The Transaction)
Represents the actual money received from the user.
*   **Source**: Created when user submits the "Record Payment" form.
*   **Key Fields**: `billing_amount` (Total Received), `payment_method`.

### 3. ServiceFeePaymentDetail (The Allocation) - *REDESIGN TARGET*
Represents the link between the Money Received (`Billing`) and the Liability (`Item`).
*   **Purpose**: Tracks exactly how much of *this* transaction paid off *that* specific item.

---

## Priority Logic
When a payment is received, it should be allocated to items in the following strict order:

1.  **Penalty / Late Fee** (Highest Priority) - Must be cleared first.
2.  **Base Service Fee** - Core charge.
3.  **Bill Categories** (Utilities, etc.) - Paid last.

**Example Scenario:**
*   **Liabilities**:
    *   Late Fee: 50 TK
    *   Service Fee: 1000 TK
    *   Water Bill: 500 TK
    *   **Total Due**: 1550 TK
*   **Payment Received**: 1200 TK

**Allocation Result**:
1.  **Late Fee**: Fully Paid (50 TK taken). Remaining Payment: 1150.
2.  **Service Fee**: Fully Paid (1000 TK taken). Remaining Payment: 150.
3.  **Water Bill**: Partially Paid (150 TK allocated). Remaining Due: 350.

---

## Schema Changes

### Updated `ServiceFeePaymentDetail` Model
We will modify (or strictly enforce usage of) `ServiceFeePaymentDetail` to act as the intersection table.

```python
class ServiceFeePaymentDetail(models.Model):
    # Link to the Money (The Transaction)
    service_fee_billing = models.ForeignKey(
        'ServiceFeeBilling', 
        on_delete=models.CASCADE,
        related_name='allocations'
    )

    # Link to the Liability (The Item)
    # NEW: Direct link to the specific item being paid
    service_fee_item = models.ForeignKey(
        'ServiceFeeItem',
        on_delete=models.CASCADE,
        related_name='payment_allocations'
    )

    # Amount from this specific transaction allocated to this item
    amount_allocated = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Snapshot of item state (Optional, for audit)
    # item_type = models.CharField(...) # Can be inferred from service_fee_item
```

### Waiver Integration
If a Waiver is applied (e.g., Waive 50 TK Late Fee), it functions like a "Credit" payment.
*   A `PenaltyWaiver` record is created.
*   It effectively reduces the `amount` (due) of the `ServiceFeeItem` OR acts as a mock payment allocation depending on implementation preference.
*   **Recommended**: Waivers reduce the *outstanding balance* of the Item directly, or create a negative Item.
    *   *Simpler Approach*: Treat Waiver as a special `ServiceFeeBilling` with method="Waiver". It allocates to the Penalty Item, clearing it.

---

## Implementation Steps

1.  **Modify `ServiceFeePaymentDetail`**: Add `service_fee_item` ForeignKey. Deprecate loose `payment_type` string if possible (or keep as cache).
2.  **Update `RecordPayment` Logic**:
    *   Fetch all `ServiceFeeItem`s for the Payment.
    *   Sort them by Priority (Penalty -> Base -> Others).
    *   Loop determining allocation amounts.
    *   Create `ServiceFeeBilling` (Parent).
    *   Create `ServiceFeePaymentDetail`s (Children) linked to specific items.
3.  **Display Logic**:
    *   Frontend shows "Paid: 1200 / 1550".
    *   Hovering/Expanding details shows:
        *   Late Fee: 50/50 (Paid)
        *   Service Fee: 1000/1000 (Paid)
        *   Water: 150/500 (Partial)
