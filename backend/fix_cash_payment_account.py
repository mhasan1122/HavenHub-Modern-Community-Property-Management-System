#!/usr/bin/env python3
"""
Fix Cash payment method to use Cash on Hand (1111) instead of Cash (1126)
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

from accounts.models import Account, DefaultAccountHead
from service_fee_management.models import PaymentMethod

def fix_cash_account():
    """Update Cash payment method to use Cash on Hand"""
    print("\n" + "="*80)
    print("🔧 FIXING CASH PAYMENT METHOD ACCOUNT")
    print("="*80 + "\n")
    
    # Get Cash payment method
    cash_pm = PaymentMethod.objects.filter(method_name__iexact='Cash').first()
    if not cash_pm:
        print("❌ Cash payment method not found!")
        return
    
    print(f"Found Payment Method: {cash_pm.method_name} (ID: {cash_pm.id})")
    
    # Get Cash on Hand account
    cash_on_hand = Account.objects.filter(accountCode='1111', isActive=True).first()
    if not cash_on_hand:
        print("❌ Cash on Hand account (1111) not found!")
        return
    
    print(f"Found Account: {cash_on_hand.accountCode} - {cash_on_hand.accountName}")
    
    # Update payment method
    old_account = cash_pm.default_account
    cash_pm.default_account = cash_on_hand
    cash_pm.save(update_fields=['default_account'])
    
    print(f"\n✅ Updated Payment Method:")
    print(f"   Old: {old_account.accountCode} - {old_account.accountName}" if old_account else "   Old: None")
    print(f"   New: {cash_on_hand.accountCode} - {cash_on_hand.accountName}")
    
    # Update or create DefaultAccountHead
    head, created = DefaultAccountHead.objects.update_or_create(
        transactionType=f"payment_method_{cash_pm.id}",
        defaults={
            'customLabel': 'Cash',
            'defaultAccount': cash_on_hand,
            'defaultEntryType': 'debit',
            'isActive': True
        }
    )
    
    action = "Created" if created else "Updated"
    print(f"\n✅ {action} DefaultAccountHead:")
    print(f"   Transaction Type: {head.transactionType}")
    print(f"   Account: {head.defaultAccount.accountCode} - {head.defaultAccount.accountName}")
    
    # Check if we can deactivate the duplicate Cash account (1126)
    duplicate_cash = Account.objects.filter(accountCode='1126', isActive=True).first()
    if duplicate_cash:
        print(f"\n⚠️  Found duplicate Cash account: {duplicate_cash.accountCode} - {duplicate_cash.accountName}")
        print(f"   You may want to deactivate or delete this account manually")
    
    print("\n" + "="*80)
    print("✅ FIX COMPLETE")
    print("="*80 + "\n")

if __name__ == '__main__':
    fix_cash_account()
