# API Hierarchy Logic Documentation

## Overview
This document outlines the payment hierarchy logic that should be implemented in the GET API endpoints to return payment breakdown details based on the priority order.

---

## API Endpoints to Update

### 1. GET `/api/service-fee-management/unpaid-periods/`
**Purpose:** Fetch unpaid periods for a unit/service_fee with payment breakdown

**Query Parameters:**
- `unit_id` (required): Unit ID
- `service_fee_id` (required): Service Fee ID

**Current Response Structure:**
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
        "service_status": "overdue"
      }
    ]
  }
}
```

**Required Addition:** Hierarchy Breakdown
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
        
        // NEW: Hierarchy breakdown
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

### 2. GET `/api/service-fee-management/residents/`
**Purpose:** Fetch residents with service fee data and payment hierarchy

**Query Parameters:**
- `service_period_month` (optional): Filter by month
- `service_period_year` (optional): Filter by year
- `include_payment_details` (optional): Include payment breakdown details

**Current Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "unit_id": 87,
      "tower_name": "Tower A",
      "unit_name": "A-101",
      "resident_name": "John Doe",
      "service_fee_id": 5,
      "service_fee_name": "Maintenance",
      "current_balance": "2450",
      "overdue_status": "overdue",
      "overdue_amount": "2450",
      "payment_status": "pending"
    }
  ]
}
```

**Required Addition:** Payment Hierarchy Detail
```json
{
  "success": true,
  "data": [
    {
      "unit_id": 87,
      "tower_name": "Tower A",
      "unit_name": "A-101",
      "resident_name": "John Doe",
      "service_fee_id": 5,
      "service_fee_name": "Maintenance",
      "current_balance": "2450",
      "overdue_status": "overdue",
      "overdue_amount": "2450",
      "payment_status": "pending",
      
      // NEW: Payment hierarchy breakdown (if include_payment_details=true)
      "payment_hierarchy": {
        "priority_order": [
          {
            "step": 1,
            "type": "penalty",
            "amount": "250",
            "description": "Penalty (after waiver)"
          },
          {
            "step": 2,
            "type": "base_fee",
            "amount": "2000",
            "description": "Base service fee"
          },
          {
            "step": 3,
            "type": "bill_categories",
            "amount": "200",
            "description": "Additional charges"
          }
        ],
        "total_due": "2450"
      }
    }
  ]
}
```

---

### 3. GET `/api/service-fee-management/billing-detailed/`
**Purpose:** Fetch detailed billing records with payment breakdown

**Query Parameters:**
- `service_period_month_from` (optional)
- `service_period_year_from` (optional)
- `service_period_month_to` (optional)
- `service_period_year_to` (optional)
- `page` (optional)
- `limit` (optional)

**Current Response Structure:**
```json
{
  "success": true,
  "data": {
    "count": 100,
    "next": "...",
    "previous": null,
    "results": [
      {
        "billing_id": "BILL-2025-01-ABC123",
        "transaction_id": "TXN-202501-XYZ789",
        "unit_id": 87,
        "unit_name": "A-101",
        "service_period_month": 12,
        "service_period_year": 2025,
        "billing_amount": "2000",
        "total_paid": "500",
        "remaining": "1500",
        "payment_method": "Cash",
        "payment_date": "2025-12-15T10:30:00Z",
        "service_status": "partial"
      }
    ]
  }
}
```

**Required Addition:** Payment Component Breakdown
```json
{
  "success": true,
  "data": {
    "count": 100,
    "results": [
      {
        "billing_id": "BILL-2025-01-ABC123",
        "transaction_id": "TXN-202501-XYZ789",
        "unit_id": 87,
        "unit_name": "A-101",
        "service_period_month": 12,
        "service_period_year": 2025,
        "billing_amount": "2000",
        "total_paid": "500",
        "remaining": "1500",
        "payment_method": "Cash",
        "payment_date": "2025-12-15T10:30:00Z",
        "service_status": "partial",
        
        // NEW: Component breakdown showing what was paid
        "payment_components": [
          {
            "type": "penalty",
            "amount": "250",
            "waived": "0",
            "paid": "250",
            "status": "fully_paid"
          },
          {
            "type": "base_fee",
            "amount": "2000",
            "paid": "0",
            "remaining": "2000",
            "status": "unpaid"
          },
          {
            "type": "bill_category",
            "category_id": 1,
            "category_name": "Maintenance Charge",
            "amount": "100",
            "paid": "0",
            "remaining": "100",
            "status": "unpaid"
          }
        ],
        "summary": {
          "total_due": "2450",
          "total_paid": "250",
          "total_remaining": "2200"
        }
      }
    ]
  }
}
```

---

## Hierarchy Logic Rules

### Payment Priority Order:

```
When calculating what should be paid from total_payment_amount:

Step 1: PAY PENALTY FIRST
├─ Amount: (gross_penalty - waived_amount)
├─ Only if penalty > 0 after waiver deduction
└─ Record in payment_components[type='penalty']

Step 2: PAY BASE FEE
├─ Amount: (original_fixed_amount - already_paid)
├─ Only owed amount (not yet paid)
└─ Record in payment_components[type='base_fee']

Step 3: PAY BILL CATEGORIES
├─ Amount: Additional charges
├─ Distribute across each category
├─ ONE record per category
└─ Record in payment_components[type='bill_category']

Step 4: EXCESS BECOMES ADVANCE
├─ If amount > 0 after all steps
├─ Create AdvancePayment(type='auto_excess')
└─ Do NOT include in payment_components
```

---

## Implementation Guide

### For Each API Endpoint:

#### Step 1: Calculate Hierarchy Breakdown
```
For each period/payment record:

remaining_amount = total_payment_input (or due_amount from DB)

// STEP 1
penalty_net = gross_penalty - waived
if penalty_net > 0:
    step_1_penalty = min(remaining_amount, penalty_net)
    remaining_amount -= step_1_penalty
else:
    step_1_penalty = 0

// STEP 2
base_fee_owed = original_amount - already_paid
if base_fee_owed > 0:
    step_2_fee = min(remaining_amount, base_fee_owed)
    remaining_amount -= step_2_fee
else:
    step_2_fee = 0

// STEP 3
categories_owed = bill_category_amount - category_already_paid
if categories_owed > 0 and len(categories) > 0:
    per_category = categories_owed / len(categories)
    for each category:
        step_3_category[i] = min(remaining_amount, per_category)
        remaining_amount -= step_3_category[i]
else:
    step_3_category = []

// STEP 4
step_4_excess = remaining_amount
```

#### Step 2: Build Response Structure
- Add `payment_hierarchy` key to period/payment object
- Include breakdown for each step
- Add `payment_components` array showing what was paid

#### Step 3: Maintain Backward Compatibility
- Keep existing fields (original_amount, due_amount, etc.)
- Add new hierarchy fields as separate keys
- Do NOT modify existing field values

---

## Response Examples

### Example 1: Full Payment (2450 TK Received)
```json
"payment_hierarchy": {
  "step_1_penalty": {
    "type": "penalty",
    "amount": "250",
    "paid": "250",
    "remaining": "0"
  },
  "step_2_base_fee": {
    "type": "base_fee",
    "amount": "2000",
    "paid": "2000",
    "remaining": "0"
  },
  "step_3_bill_categories": {
    "type": "bill_categories",
    "amount": "200",
    "paid": "0",
    "remaining": "200"
  },
  "step_4_excess": {
    "type": "advance_payment",
    "amount": "0"
  }
}
```

### Example 2: Partial Payment (1000 TK Received)
```json
"payment_hierarchy": {
  "step_1_penalty": {
    "type": "penalty",
    "amount": "250",
    "paid": "250",
    "remaining": "0"
  },
  "step_2_base_fee": {
    "type": "base_fee",
    "amount": "2000",
    "paid": "750",
    "remaining": "1250"
  },
  "step_3_bill_categories": {
    "type": "bill_categories",
    "amount": "200",
    "paid": "0",
    "remaining": "200"
  },
  "step_4_excess": {
    "type": "advance_payment",
    "amount": "0"
  }
}
```

### Example 3: Over Payment (3000 TK Received)
```json
"payment_hierarchy": {
  "step_1_penalty": {
    "type": "penalty",
    "amount": "250",
    "paid": "250",
    "remaining": "0"
  },
  "step_2_base_fee": {
    "type": "base_fee",
    "amount": "2000",
    "paid": "2000",
    "remaining": "0"
  },
  "step_3_bill_categories": {
    "type": "bill_categories",
    "amount": "200",
    "paid": "200",
    "remaining": "0"
  },
  "step_4_excess": {
    "type": "advance_payment",
    "amount": "300",
    "note": "Saved as AdvancePayment(auto_excess)"
  }
}
```

---

## Database Queries Needed

### For Hierarchy Calculation:

1. **Get Penalty Details:**
   ```sql
   SELECT gross_penalty_amount, waived_amount
   FROM (payment calculation subquery)
   WHERE service_period_month = ? AND service_period_year = ?
   ```

2. **Get Base Fee Details:**
   ```sql
   SELECT base_service_amount AS original_amount, 
          SUM(total_paid) AS already_paid
   FROM service_fee_payment_details
   WHERE servicefeepaymentid_id = ?
   ```

3. **Get Bill Categories:**
   ```sql
   SELECT bill_category_id, name, amount
   FROM service_fee_bill_categories
   WHERE servicefeepaymentid_id = ?
   ```

4. **Calculate Remaining:**
   ```sql
   SELECT (original_amount + bill_cat_total - already_paid) AS remaining
   ```

---

## Implementation Checklist

- [ ] Update `ServiceFeeUnpaidPeriodsView.get()` to include `payment_hierarchy`
- [ ] Update `ServiceFeeResidentListView` to include hierarchy (conditional)
- [ ] Update `BillingDetailedListView` to include `payment_components`
- [ ] Create serializer for `payment_hierarchy` structure
- [ ] Create serializer for `payment_components` structure
- [ ] Add hierarchy calculation function in views.py
- [ ] Test with multiple scenarios (full, partial, over payment)
- [ ] Update frontend to use new hierarchy data
- [ ] Document API changes in Swagger/OpenAPI

---

## Notes

- All amounts should be returned as strings (for Decimal precision)
- Hierarchy is calculated based on priority order, NOT payment date
- Bill categories should be split one record per category
- Excess payment should NOT be included in payment_components
- Response backward compatibility is critical

