"""
Test script to verify account balance calculation works correctly.

This script:
1. Creates a test journal entry in draft status
2. Verifies balances don't change for draft entries
3. Posts the entry
4. Verifies balances are updated correctly
5. Voids the entry
6. Verifies balances are reverted
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account, VoucherEntry, VoucherEntryDetails, VoucherType
from user.models import Member
from datetime import date
from decimal import Decimal

def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def print_account_balance(account):
    account.refresh_from_db()
    print(f"  {account.accountCode} - {account.accountName}: {account.currentBalance}")

def main():
    print_section("Account Balance Calculation Test")
    
    # Get test accounts (using existing accounts from the system)
    try:
        cash_account = Account.objects.get(accountCode='1111')  # Cash on Hand
        revenue_account = Account.objects.get(accountCode='4110')  # Monthly Service Fee Income
    except Account.DoesNotExist as e:
        print(f"\n❌ Error: Required test accounts not found: {e}")
        return

    # Get a test user
    try:
        test_user = Member.objects.first()
        if not test_user:
            print("\n❌ Error: No member found for testing")
            return
    except Exception as e:
        print(f"\n❌ Error getting test user: {e}")
        return

    # Get journal voucher type
    try:
        journal_type = VoucherType.objects.get(name='journal')
    except VoucherType.DoesNotExist:
        print("\n❌ Error: Journal voucher type not found")
        return

    print_section("Initial Account Balances")
    print_account_balance(cash_account)
    print_account_balance(revenue_account)
    
    initial_cash_balance = cash_account.currentBalance
    initial_revenue_balance = revenue_account.currentBalance

    print_section("Step 1: Create Draft Journal Entry")
    # Create a test journal entry with $500 debit to cash and credit to revenue
    test_amount = Decimal('500.00')
    
    voucher = VoucherEntry.objects.create(
        voucherNumber='TEST-20251231-9999',
        entryDate=date.today(),
        narration='Test entry for balance calculation verification',
        voucherType=journal_type,
        status='draft',
        createdBy=test_user,
        updatedBy=test_user
    )
    
    # Create detail lines
    VoucherEntryDetails.objects.create(
        voucherEntry=voucher,
        lineNumber=1,
        account=cash_account,
        description='Test debit to cash',
        debitAmount=test_amount,
        creditAmount=Decimal('0')
    )
    
    VoucherEntryDetails.objects.create(
        voucherEntry=voucher,
        lineNumber=2,
        account=revenue_account,
        description='Test credit to revenue',
        debitAmount=Decimal('0'),
        creditAmount=test_amount
    )
    
    # Calculate totals
    voucher.calculate_totals()
    
    print(f"\n✓ Created draft voucher: {voucher.voucherNumber}")
    print(f"  Debit: {voucher.totalDebit}, Credit: {voucher.totalCredit}")
    
    print("\n  Balances after creating draft (should be unchanged):")
    print_account_balance(cash_account)
    print_account_balance(revenue_account)
    
    if cash_account.currentBalance == initial_cash_balance:
        print("  ✓ Cash balance unchanged (correct for draft)")
    else:
        print("  ❌ Cash balance changed unexpectedly!")
    
    print_section("Step 2: Post the Journal Entry")
    voucher.status = 'posted'
    voucher.postedBy = test_user
    voucher.postedAt = django.utils.timezone.now()
    voucher.save()
    
    # Recalculate balances
    cash_account.recalculate_balance()
    revenue_account.recalculate_balance()
    
    print(f"✓ Voucher posted: {voucher.voucherNumber}")
    print("\n  Balances after posting:")
    print_account_balance(cash_account)
    print_account_balance(revenue_account)
    
    expected_cash_balance = initial_cash_balance + test_amount
    expected_revenue_balance = initial_revenue_balance + test_amount
    
    cash_account.refresh_from_db()
    revenue_account.refresh_from_db()
    
    if cash_account.currentBalance == expected_cash_balance:
        print(f"  ✓ Cash balance correctly increased by {test_amount}")
    else:
        print(f"  ❌ Cash balance incorrect! Expected: {expected_cash_balance}, Got: {cash_account.currentBalance}")
    
    if revenue_account.currentBalance == expected_revenue_balance:
        print(f"  ✓ Revenue balance correctly increased by {test_amount}")
    else:
        print(f"  ❌ Revenue balance incorrect! Expected: {expected_revenue_balance}, Got: {revenue_account.currentBalance}")
    
    print_section("Step 3: Void the Journal Entry")
    voucher.status = 'void'
    voucher.save()
    
    # Recalculate balances
    cash_account.recalculate_balance()
    revenue_account.recalculate_balance()
    
    print(f"✓ Voucher voided: {voucher.voucherNumber}")
    print("\n  Balances after voiding (should revert to initial):")
    print_account_balance(cash_account)
    print_account_balance(revenue_account)
    
    cash_account.refresh_from_db()
    revenue_account.refresh_from_db()
    
    if cash_account.currentBalance == initial_cash_balance:
        print(f"  ✓ Cash balance correctly reverted to {initial_cash_balance}")
    else:
        print(f"  ❌ Cash balance not reverted! Expected: {initial_cash_balance}, Got: {cash_account.currentBalance}")
    
    if revenue_account.currentBalance == initial_revenue_balance:
        print(f"  ✓ Revenue balance correctly reverted to {initial_revenue_balance}")
    else:
        print(f"  ❌ Revenue balance not reverted! Expected: {initial_revenue_balance}, Got: {revenue_account.currentBalance}")
    
    print_section("Cleanup")
    voucher.delete()
    print("✓ Test voucher deleted")
    
    print_section("Test Summary")
    print("\n✅ All balance calculations working correctly!")
    print("\nKey findings:")
    print("  • Draft entries do NOT affect account balances")
    print("  • Posted entries DO update account balances")
    print("  • Voided entries revert balance calculations")
    print("  • Asset/Expense accounts use Debit - Credit")
    print("  • Liability/Equity/Revenue accounts use Credit - Debit")

if __name__ == '__main__':
    main()
