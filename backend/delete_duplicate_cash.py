#!/usr/bin/env python3
"""
Delete the duplicate unused Cash account (1126)
"""
import os
import sys
import django

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account, VoucherEntryDetails

def delete_duplicate_cash():
    print("\n" + "="*80)
    print("🗑️  DELETING DUPLICATE CASH ACCOUNT")
    print("="*80 + "\n")
    
    # Find the duplicate Cash account
    duplicate = Account.objects.filter(accountCode='1126', accountName='Cash').first()
    
    if not duplicate:
        print("❌ Duplicate Cash account (1126) not found")
        return
    
    print(f"Found account: {duplicate.accountCode} - {duplicate.accountName}")
    print(f"Balance: {duplicate.currentBalance}")
    print(f"Active: {duplicate.isActive}")
    
    # Check if it has any transactions
    debit_count = VoucherEntryDetails.objects.filter(account=duplicate).count()
    
    if debit_count > 0:
        print(f"\n⚠️  WARNING: This account has {debit_count} transactions!")
        print("Cannot delete. Please deactivate instead.")
        return
    
    print(f"\n✅ Safe to delete (0 transactions)")
    
    # Delete the account
    duplicate.delete()
    
    print(f"✅ Deleted account 1126 - Cash")
    
    print("\n" + "="*80)
    print("✅ CLEANUP COMPLETE")
    print("="*80 + "\n")

if __name__ == '__main__':
    delete_duplicate_cash()
