# Smart Payment Account System

## Overview

Automatic account head generation for payment methods under **Cash and Cash Equivalents (CCE)** - Account Code **1110**.

## How It Works

### When a Payment is Received

The system automatically:

1. **Checks** if the `PaymentMethod` has a `default_account` already linked
2. **Searches** for existing accounts under CCE (1110) matching the payment method name
3. **Fuzzy matches** similar payment methods:
   - Mobile services (bKash, Nagad, Rocket, Upay) → "Mobile Financial Services"
   - Card payments (Visa, Mastercard, Amex) → "Card" account
4. **Creates** new account under CCE (1110) if no match found
5. **Links** the account to `PaymentMethod.default_account` for future reuse
6. **Registers** in `DefaultAccountHead` for easy lookup

### Account Code Generation

- **Parent**: 1110 (Cash and Cash Equivalents)
- **New codes**: Automatically generated sequentially (1126, 1127, 1128, etc.)
- **Existing codes**: Reuses existing accounts when found

## Example Scenarios

### Scenario 1: First bKash Payment

**Before Payment:**
- bKash payment method exists but has no `default_account`
- Account "Mobile Financial Services (1125)" exists under CCE

**After Payment:**
- System finds "Mobile Financial Services" (fuzzy match)
- Links bKash → Account 1125
- Voucher created with debit to 1125

### Scenario 2: New Payment Method (e.g., "AmarPay")

**Before Payment:**
- AmarPay payment method exists
- No matching account under CCE

**After Payment:**
- System creates new account: "1126 - AmarPay"
- Links AmarPay → Account 1126
- Voucher created with debit to 1126

### Scenario 3: Mastercard Payment via PayStation

**Before Payment:**
- PayStation returns `payment_method: "mastercard"`
- System normalizes to "Mastercard"
- Mastercard PaymentMethod created automatically

**After Payment:**
- System searches for "Card" account under CCE (fuzzy match)
- If found, uses it; if not, creates "1127 - Mastercard"
- Links Mastercard → Account
- Voucher created with appropriate debit

## Chart of Accounts Structure

```
1110 - Cash and Cash Equivalents (CCE)
  ├── 1111 - Cash on Hand
  ├── 1112 - Petty Cash
  ├── 1121 - Bank Account - Main
  ├── 1122 - Bank Account - Service Fee Collection
  ├── 1125 - Mobile Financial Services (bKash/Nagad/Rocket)
  ├── 1126 - Mastercard (auto-created)
  ├── 1127 - AmarPay (auto-created)
  └── ... (dynamically created as needed)
```

## Function Reference

### `get_or_create_payment_account()`

**Location:** `backend/service_fee_management/utils/voucher_generator.py`

**Parameters:**
- `payment_method_obj`: PaymentMethod instance
- `payment_method_id`: Fallback payment method ID
- `created_by`: Member instance for audit trail

**Returns:** Account instance

**Features:**
- ✅ Automatic account creation under CCE (1110)
- ✅ Fuzzy matching for similar payment methods
- ✅ Auto-linking to PaymentMethod.default_account
- ✅ DefaultAccountHead registration
- ✅ Graceful fallback to legacy mapping

## Updated Files

1. **`backend/service_fee_management/utils/voucher_generator.py`**
   - Added `get_or_create_payment_account()` function
   - Updated `create_payment_voucher()` to use smart function
   
2. **`backend/service_fee_management/paystation_views.py`**
   - Fixed HTTP 400 → HTTP 200 for failed payment callbacks
   - Existing PaymentMethod auto-creation preserved

## Benefits

1. **Automatic**: No manual account creation needed
2. **Consistent**: All payment accounts under CCE (1110)
3. **Flexible**: Supports any payment method
4. **Reusable**: Links accounts for future transactions
5. **Traceable**: Full audit trail via DefaultAccountHead
6. **Smart**: Fuzzy matching prevents duplicate accounts

## Migration Notes

### For Existing Payment Methods

The system will automatically:
1. Find or create accounts on first use
2. Link them to existing PaymentMethod records
3. Reuse for all future transactions

### No Manual Intervention Required

- ✅ Existing accounts are preserved and reused
- ✅ New accounts are created only when needed
- ✅ PaymentMethod → Account links are automatic

## Testing

### Test 1: Cash Payment
```
Payment Method: Cash
Expected: Uses Account 1111 (Cash on Hand)
```

### Test 2: bKash Payment
```
Payment Method: bKash
Expected: Uses Account 1125 (Mobile Financial Services)
```

### Test 3: New Payment Method
```
Payment Method: "TapPay" (new)
Expected: Creates Account 1126 - TapPay
```

### Test 4: Mastercard via PayStation
```
Payment Gateway: PayStation
Payment Method: "mastercard"
Expected: 
  1. Normalizes to "Mastercard"
  2. Creates PaymentMethod if needed
  3. Links to Card account or creates new
```

## Troubleshooting

### Issue: Account not created

**Check:**
1. CCE parent account (1110) exists
2. PaymentMethod record exists
3. Check logs for error messages

### Issue: Wrong account used

**Check:**
1. `PaymentMethod.default_account` field value
2. Account name matching logic
3. Fuzzy match rules

### Issue: Duplicate accounts created

**Cause:** Multiple concurrent payment processes
**Solution:** Database transaction isolation ensures atomicity

## Future Enhancements

1. **Admin Interface**: Bulk link payment methods to accounts
2. **Migration Script**: Auto-link all existing payment methods
3. **Account Mapping UI**: Visual chart showing payment → account links
4. **Analytics**: Track which payment methods are most used

## Related Documentation

- [Voucher Implementation Summary](./VOUCHER_IMPLEMENTATION_SUMMARY.md)
- [Voucher Double Entry Improvements](./VOUCHER_DOUBLE_ENTRY_IMPROVEMENTS.md)
- [PayStation Integration Guide](../PAYSTATION_INTEGRATION_GUIDE.md)
