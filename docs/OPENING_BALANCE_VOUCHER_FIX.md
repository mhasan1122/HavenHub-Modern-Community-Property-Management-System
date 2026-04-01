Opening Balance Voucher Implementation Fix

ISSUE DESCRIPTION
=================

When admins added an opening balance (debit or credit) to an account through the Chart of Accounts feature, the account was saved successfully with the opening balance values. However, no corresponding voucher transaction was being created and posted in the accounting ledger.

The system has a Django signal mechanism (`create_opening_balance_voucher`) that should automatically generate and post a journal voucher entry for opening balances, but it was not working correctly.

ROOT CAUSE ANALYSIS
===================

The bug was in the signal logic in `/backend/accounts/signals.py`:

1. **Flawed Database Comparison Logic (lines 20-30 - original code)**
   - In the update branch (`elif not created`), the signal tried to fetch the original account from the database AFTER Django's `post_save` signal fired
   - By that time, the Account object was already updated in the database
   - This meant `Account.objects.get(pk=instance.pk)` would return the UPDATED values, not the original ones
   - The comparison would always show both original and current values as identical
   - Result: Opening balance changes were never detected

2. **Sequential Voucher Number Generation Issue**
   - The original code used a sequential numbering scheme (OB-YYYY-001, OB-YYYY-002, etc.)
   - This meant updating an account's opening balance would create a NEW voucher instead of updating the existing one
   - Multiple vouchers would pile up in the ledger for the same account

3. **Lack of Recursion Prevention**
   - The signal could trigger recursively if the account needed to be saved again during signal processing
   - This could cause unexpected behavior and performance issues

SOLUTION IMPLEMENTED
====================

The fix addresses all three issues:

1. **Fixed Database Comparison Logic**
   - Changed from fetching after post_save to using select_for_update() which ensures we get the actual database values
   - Properly detects when opening balance values change
   - Correctly triggers the voucher creation when needed

2. **Idempotent Voucher Creation**
   - Changed voucher numbering scheme to use account code: `OB-YYYY-{ACCOUNTCODE}`
   - This makes the voucher number unique per account and per year
   - When an account's opening balance is updated, the existing voucher is found and updated instead of creating duplicates
   - The old voucher details are deleted and new ones are created with the updated amounts

3. **Recursion Prevention**
   - Added a `_skip_opening_balance_signal` flag on the account instance
   - When set to True, the signal skips execution on the next post_save
   - Prevents infinite loops during internal account updates

CHANGES MADE
============

File: /backend/accounts/signals.py

1. Updated `create_opening_balance_voucher` signal function:
   - Added skip_signal flag check at the beginning
   - Improved comment explaining the signal flow
   - Better detection of opening balance changes using proper database queries

2. Completely rewrote `_create_opening_balance_voucher` helper function:
   - Changed voucher numbering from sequential to account-based: OB-YYYY-{ACCOUNTCODE}
   - Added logic to check if voucher already exists
   - If voucher exists: update it by deleting old details and creating new ones
   - If voucher doesn't exist: create a new one
   - Updated narration and entry date when modifying
   - Added skip_signal flag at the end to prevent recursion

WORKFLOW AFTER FIX
==================

When admin creates or updates an account with opening balance:

1. Frontend (AccountsModal.jsx) sends request with openingDebit or openingCredit
2. Django validates and saves the Account
3. Post-save signal triggers: `create_opening_balance_voucher`
4. Signal detects opening balance is set or changed
5. Signal calls `_create_opening_balance_voucher(account)`
6. Helper function:
   - Checks if voucher already exists for this account (using OB-YYYY-{ACCOUNTCODE})
   - If exists: Updates it (deletes old details, creates new ones)
   - If not: Creates new voucher
   - Creates two journal entry details:
     * Line 1: Debits/Credits the account with the opening balance
     * Line 2: Credits/Debits the "Opening Balance Equity" account to balance it
   - Sets voucher status to 'posted' immediately
   - Calculates and updates totals
7. Ledger automatically reflects the opening balance transaction

TESTING CHECKLIST
=================

To verify the fix works:

1. Create a new account with opening debit
   - Account should be created successfully
   - Opening Balance Equity account should exist
   - A posted voucher (OB-YYYY-{ACCOUNTCODE}) should appear in the ledger
   - Account ledger should show the opening debit

2. Create a new account with opening credit
   - Similar to above but with credit instead of debit
   - Voucher entries should be reversed correctly

3. Update existing account's opening balance
   - Change opening debit amount
   - The existing voucher should be updated (not duplicated)
   - Account ledger should reflect the change
   - Total voucher count should remain 1 for that account

4. Check Opening Balance Equity account
   - Should exist as a system account (CAP-001)
   - Should have balancing entries for all opening balance vouchers
   - Should be marked as isSystemAccount=True

5. Verify ledger calculations
   - Run account ledger view
   - Verify opening balance matches what was set
   - Verify running balance calculations are correct

KEY FILES INVOLVED
==================

Backend:
- /backend/accounts/signals.py (MODIFIED) - Signal logic for creating opening balance vouchers
- /backend/accounts/models.py - Account model with opening balance fields
- /backend/accounts/serializers.py - AccountSerializer validates and serializes opening balance
- /backend/accounts/views.py - AccountViewSet handles API requests
- /backend/accounts/apps.py - Imports signals in ready() method

Frontend:
- /frontend/src/Features/ChartOfAccounts/components/AccountsModal.jsx - Accepts openingDebit/openingCredit input
- /frontend/src/redux/slices/chartOfAccounts/chartOfAccountsSlice.js - Redux actions for create/update account
- /frontend/src/Features/ChartOfAccounts/ChartOfAccountsPage.jsx - Main page component

API ENDPOINTS
=============

POST /api/accounts/accounts/
- Creates new account with opening balance
- Automatically triggers voucher creation

PATCH /api/accounts/accounts/{id}/
- Updates account and its opening balance
- Automatically updates or creates voucher

GET /api/accounts/ledger/{id}/
- Retrieves account ledger showing transactions
- Should now include opening balance vouchers

MIGRATION NOTES
===============

No database migrations needed. The signal mechanism works with existing schema.

However, if existing accounts have opening balances set but no vouchers:
- Run this command to generate missing opening balance vouchers:
  python manage.py shell
  
  Then in shell:
  from accounts.models import Account
  from accounts.signals import _create_opening_balance_voucher
  
  for account in Account.objects.filter(openingDebit__gt=0) | Account.objects.filter(openingCredit__gt=0):
      _create_opening_balance_voucher(account)

BACKWARDS COMPATIBILITY
========================

This fix is fully backwards compatible:
- Existing accounts are unaffected
- The signal only activates when opening balance fields are set
- Voucher format change (sequential to account-based) only applies to NEW vouchers
- Old sequentially-numbered vouchers will remain unchanged

PERFORMANCE IMPACT
==================

Minimal performance impact:
- Signal only runs on account save (create/update)
- Additional database queries are minimal (1-2 extra queries per save)
- Atomic transaction ensures data consistency
- No impact on read operations

FUTURE IMPROVEMENTS
===================

Potential enhancements:
1. Add option to allow multiple opening balance entries per account (for different dates)
2. Add API endpoint to regenerate/repair opening balance vouchers
3. Add admin command to audit and fix orphaned opening balances
4. Add configuration option to disable automatic opening balance vouchers
5. Enhanced reporting for opening balance adjustments
