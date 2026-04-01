#!/usr/bin/env python3
"""
Create individual accounts for each payment method under CCE
"""
import os
import sys
import django

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account
from service_fee_management.models import PaymentMethod
from service_fee_management.utils.voucher_generator import get_or_create_payment_account

def create_individual_accounts():
    print("\n" + "="*100)
    print("🔧 CREATING INDIVIDUAL ACCOUNTS FOR EACH PAYMENT METHOD")
    print("="*100 + "\n")
    
    # Get CCE parent
    cce = Account.objects.filter(accountCode='1110', isActive=True).first()
    if not cce:
        print("❌ CCE parent account not found!")
        return
    
    # Get all active payment methods
    payment_methods = PaymentMethod.objects.filter(is_active=True).order_by('id')
    
    print(f"📋 Found {payment_methods.count()} payment methods\n")
    
    for pm in payment_methods:
        print(f"{'='*100}")
        print(f"Payment Method: {pm.method_name} (ID: {pm.id})")
        
        if pm.default_account:
            print(f"Current Account: {pm.default_account.accountCode} - {pm.default_account.accountName}")
        else:
            print(f"Current Account: None")
        
        # Check if account name matches payment method name exactly
        if pm.default_account and pm.default_account.accountName == pm.method_name:
            print(f"✅ Already has individual account")
            print()
            continue
        
        # Clear the default_account to force creation of new individual account
        pm.default_account = None
        pm.save(update_fields=['default_account'])
        
        # Create or get individual account
        account = get_or_create_payment_account(
            payment_method_obj=pm,
            payment_method_id=pm.id,
            created_by=None
        )
        
        if account:
            print(f"✅ New Account: {account.accountCode} - {account.accountName}")
            
            # Verify it's individual
            if account.accountName == pm.method_name:
                print(f"✅ Confirmed: Individual account created")
            else:
                print(f"⚠️  Warning: Account name doesn't match payment method")
        else:
            print(f"❌ Failed to create account")
        
        print()
    
    print("\n" + "="*100)
    print("📊 FINAL ACCOUNT STRUCTURE UNDER CCE")
    print("="*100 + "\n")
    
    child_accounts = Account.objects.filter(
        parentAccount=cce,
        isActive=True
    ).order_by('accountCode')
    
    for acc in child_accounts:
        # Check if linked to payment method
        pm_link = PaymentMethod.objects.filter(default_account=acc, is_active=True).first()
        if pm_link:
            print(f"✅ {acc.accountCode} - {acc.accountName} → Linked to: {pm_link.method_name}")
        else:
            print(f"⚪ {acc.accountCode} - {acc.accountName} (No payment method link)")
    
    print("\n" + "="*100)
    print("✅ COMPLETE")
    print("="*100 + "\n")

if __name__ == '__main__':
    create_individual_accounts()
