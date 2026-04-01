#!/usr/bin/env python3
"""
Check if payment method accounts are properly created under CCE (1110)
"""
import os
import sys
import django

# Add the project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account
from service_fee_management.models import PaymentMethod
from service_fee_management.utils.voucher_generator import get_or_create_payment_account

def check_cce_parent():
    """Check if CCE parent account exists"""
    print("\n" + "="*80)
    print("1. CHECKING CCE PARENT ACCOUNT (1110)")
    print("="*80)
    
    cce = Account.objects.filter(accountCode='1110', isActive=True).first()
    if cce:
        print(f"✅ Found CCE: {cce.accountCode} - {cce.accountName}")
        return cce
    else:
        print("❌ CCE parent account (1110) NOT FOUND!")
        return None

def check_existing_payment_accounts(cce):
    """Check existing accounts under CCE"""
    print("\n" + "="*80)
    print("2. EXISTING ACCOUNTS UNDER CCE (1110)")
    print("="*80)
    
    if not cce:
        print("❌ Cannot check - CCE parent not found")
        return
    
    child_accounts = Account.objects.filter(
        parentAccount=cce,
        isActive=True
    ).order_by('accountCode')
    
    if child_accounts.exists():
        print(f"\n📋 Found {child_accounts.count()} active accounts under CCE:\n")
        for acc in child_accounts:
            print(f"   {acc.accountCode} - {acc.accountName}")
            print(f"      Type: {acc.accountType}")
            if acc.description:
                print(f"      Description: {acc.description}")
            print()
    else:
        print("⚠️  No accounts found under CCE")

def check_payment_methods():
    """Check all payment methods and their linked accounts"""
    print("\n" + "="*80)
    print("3. PAYMENT METHODS AND THEIR LINKED ACCOUNTS")
    print("="*80)
    
    payment_methods = PaymentMethod.objects.filter(is_active=True)
    
    if not payment_methods.exists():
        print("❌ No active payment methods found")
        return
    
    print(f"\n📋 Found {payment_methods.count()} active payment methods:\n")
    
    for pm in payment_methods:
        print(f"💳 {pm.method_name} (ID: {pm.id})")
        
        if pm.default_account:
            print(f"   ✅ Linked to: {pm.default_account.accountCode} - {pm.default_account.accountName}")
        else:
            print(f"   ⚠️  No default_account linked")
        print()

def test_payment_account_creation():
    """Test creating/getting payment accounts for each payment method"""
    print("\n" + "="*80)
    print("4. TESTING PAYMENT ACCOUNT CREATION")
    print("="*80)
    
    payment_methods = PaymentMethod.objects.filter(is_active=True)
    
    if not payment_methods.exists():
        print("❌ No active payment methods found")
        return
    
    print(f"\n🧪 Testing account creation for {payment_methods.count()} payment methods:\n")
    
    for pm in payment_methods:
        print(f"Testing: {pm.method_name}")
        try:
            account = get_or_create_payment_account(
                payment_method_obj=pm,
                payment_method_id=pm.id,
                created_by=None
            )
            
            if account:
                print(f"   ✅ Account: {account.accountCode} - {account.accountName}")
                
                # Check if parent is CCE
                if account.parentAccount and account.parentAccount.accountCode == '1110':
                    print(f"   ✅ Parent: {account.parentAccount.accountCode} (CCE) ✓")
                else:
                    parent_info = f"{account.parentAccount.accountCode}" if account.parentAccount else "No Parent"
                    print(f"   ⚠️  Parent: {parent_info} (NOT under CCE!)")
                
                # Check if linked to payment method
                pm.refresh_from_db()
                if pm.default_account and pm.default_account.id == account.id:
                    print(f"   ✅ Linked to PaymentMethod ✓")
                else:
                    print(f"   ⚠️  NOT linked to PaymentMethod")
            else:
                print(f"   ❌ No account returned!")
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
        
        print()

def check_default_account_heads():
    """Check DefaultAccountHead entries for payment methods"""
    print("\n" + "="*80)
    print("5. DEFAULT ACCOUNT HEADS FOR PAYMENT METHODS")
    print("="*80)
    
    from accounts.models import DefaultAccountHead
    
    payment_heads = DefaultAccountHead.objects.filter(
        transactionType__startswith='payment_method_',
        isActive=True
    ).order_by('transactionType')
    
    if payment_heads.exists():
        print(f"\n📋 Found {payment_heads.count()} payment method default heads:\n")
        for head in payment_heads:
            print(f"   {head.customLabel or head.transactionType}")
            print(f"      Transaction Type: {head.transactionType}")
            if head.defaultAccount:
                print(f"      Account: {head.defaultAccount.accountCode} - {head.defaultAccount.accountName}")
            print(f"      Entry Type: {head.defaultEntryType}")
            print()
    else:
        print("⚠️  No payment method default account heads found")

def main():
    print("\n" + "="*80)
    print("🔍 PAYMENT METHOD ACCOUNT VERIFICATION")
    print("="*80)
    
    # Check CCE parent
    cce = check_cce_parent()
    
    # Check existing accounts under CCE
    check_existing_payment_accounts(cce)
    
    # Check payment methods
    check_payment_methods()
    
    # Test account creation
    test_payment_account_creation()
    
    # Check default account heads
    check_default_account_heads()
    
    print("\n" + "="*80)
    print("✅ VERIFICATION COMPLETE")
    print("="*80 + "\n")

if __name__ == '__main__':
    main()
