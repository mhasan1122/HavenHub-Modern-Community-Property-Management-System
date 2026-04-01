# Service Fee Billing - Owner-Only Bill Generation Fix

## Problem Statement

**Before the fix:**
- The system was generating **TWO separate bills** for the same unit in the same period:
  1. One bill for the **owner** (account_holder_type='owner')
  2. One bill for the **resident** (account_holder_type='resident')
  
- When a resident made a payment, it was deducted from the resident's separate bill instead of the owner's bill

**Example of the problem:**
```
December 2025 - Unit 174:
- Bill ID 1: Owner bill - 2460.00 BDT - Status: 'due'
- Bill ID 2: Resident bill - 2460.00 BDT - Status: 'partial' (920.00 paid by resident)
```

## Solution

**After the fix:**
- Only **ONE bill** is generated per unit per service fee per period
- Bills are **ALWAYS generated in the OWNER's name only**
- Residents can still make payments, but those payments reduce the **OWNER's bill amount**
- Residents are considered "under" the owner - they don't get separate bills

**Correct behavior:**
```
December 2025 - Unit 174:
- Bill ID 1: Owner bill - 2460.00 BDT
  - When resident pays 920.00 BDT → remaining amount becomes 1540.00 BDT
  - Status changes from 'due' to 'partial'
  - The payment is credited to the OWNER's bill
```

## Changes Made

### 1. Modified SQL Query in `service_fee_generator.py`

**Before:**
```sql
/* Account Holder Logic - Prioritize Owner, then Resident, else NULL */
CASE 
    WHEN tow.id IS NOT NULL THEN 'owner'
    WHEN tr.id IS NOT NULL THEN 'resident'  ← Creates SECOND bill for residents
    ELSE NULL
END as account_holder_type,
COALESCE(tow.id, tr.id) as account_holder_id,

WHERE
    AND (tow.id IS NOT NULL OR tr.id IS NOT NULL)  ← Allows both to pass
```

**After:**
```sql
/* Account Holder Logic - ONLY OWNERS */
CASE 
    WHEN tow.id IS NOT NULL THEN 'owner'
    ELSE NULL
END as account_holder_type,
tow.id as account_holder_id,

WHERE
    AND tow.id IS NOT NULL  ← Requires owner only
```

### 2. Removed Resident JOIN

- Removed the `towers_resident` LEFT JOIN since we're not generating bills for residents
- Kept only the `towers_owner` LEFT JOIN

### 3. Updated Error Messages

- Changed validation messages to clarify that bills require an owner
- "No registered owner. Bills are generated for owners only."

### 4. Added Documentation

- Added clear business rule comments in the function docstring
- Clarified that residents can pay but don't get separate bills

## Business Rules (Updated)

1. **One Bill Per Unit Per Period**: Each unit gets exactly ONE service fee bill per period
2. **Owner is Primary Account Holder**: Bills are ALWAYS issued to the owner
3. **Residents Can Pay**: Residents living in the unit can make payments
4. **Payments Reduce Owner's Bill**: When a resident pays, it reduces the owner's outstanding amount
5. **No Separate Resident Bills**: Residents don't get their own bills - they're "under" the owner

## Testing

Use the test script to verify the fix:

```bash
cd backend
python test_owner_only_bill_generation.py
```

The test will:
1. Check if the unit has an owner
2. Generate bills for the test period
3. Verify that only ONE bill is created
4. Confirm the bill is in the owner's name
5. Ensure no resident bills exist

## Impact on Existing Data

### Existing Resident Bills

If you have existing bills with `account_holder_type='resident'` in the database:

1. **Future Bills**: New bills will only be generated for owners
2. **Past Bills**: Existing resident bills remain in the database for historical records
3. **Payments**: You may need to manually merge or reconcile resident payments to owner bills

### Recommended Cleanup Query

```sql
-- Find units with multiple bills in the same period
SELECT 
    unit_id,
    service_fee_id,
    service_period_year,
    service_period_month,
    COUNT(*) as bill_count,
    GROUP_CONCAT(id) as bill_ids,
    GROUP_CONCAT(account_holder_type) as holder_types
FROM service_fee_management_servicefeegenerate
GROUP BY unit_id, service_fee_id, service_period_year, service_period_month
HAVING COUNT(*) > 1
ORDER BY service_period_year DESC, service_period_month DESC;
```

## Related Files Modified

1. `/backend/service_fee_management/utils/service_fee_generator.py`
   - Updated SQL query to generate bills only for owners
   - Removed resident fallback logic
   - Updated validation messages
   - Added business rule documentation

2. `/backend/test_owner_only_bill_generation.py` (NEW)
   - Test script to verify the fix

3. `/backend/OWNER_ONLY_BILLING_FIX.md` (THIS FILE)
   - Documentation of the change

## Migration Notes

**No database migration required** - this is a logic change only. The `account_holder_type` field and other database schema remain unchanged.

However, you should:
1. ✅ Test the bill generation with the new code
2. ✅ Verify no duplicate bills are created
3. ⚠️  Review existing data for any resident bills that need cleanup
4. ⚠️  Update any frontend code that might expect resident bills

## Questions & Answers

**Q: Can residents still make payments?**  
A: Yes! Residents can make payments. Those payments will reduce the owner's bill amount.

**Q: What happens to existing resident bills?**  
A: They remain in the database. New bills will only be generated for owners.

**Q: Will this affect past payment records?**  
A: No. Past payment records remain unchanged. This only affects future bill generation.

**Q: What if a unit has no owner?**  
A: No bill will be generated. The system requires an owner to generate a bill.

**Q: What if a unit has multiple owners?**  
A: The system selects one owner (highest ownership percentage) as the primary account holder for billing.

---

**Date**: February 6, 2026  
**Issue**: Duplicate bills for owner and resident  
**Resolution**: Modified bill generation to create owner-only bills  
**Status**: ✅ Fixed
