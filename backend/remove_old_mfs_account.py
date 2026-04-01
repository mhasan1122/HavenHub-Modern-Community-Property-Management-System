#!/usr/bin/env python3
"""
Remove the old shared Mobile Financial Services account (1125)
"""
import os
import sys
import django

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account, VoucherEntryDetails

def remove_old_mfs_account():
    print("\n" + "="*80)
    print("🗑️  REMOVING OLD MOBILE FINANCIAL SERVICES ACCOUNT")
    print("="*80 + "\n")
    
    # Find the old MFS account
    old_mfs = Account.objects.filter(
        accountCode='1125',
        accountName__icontains='Mobile Financial Services'
    ).first()
    
    if not old_mfs:
        print("❌ Old Mobile Financial Services account not found")
        return
    
    print(f"Found: {old_mfs.accountCode} - {old_mfs.accountName}")
    print(f"Balance: {old_mfs.currentBalance}")
    
    # Check if it has any voucher entries
    entries_count = VoucherEntryDetails.objects.filter(account=old_mfs).count()
    print(f"Voucher entries: {entries_count}")
    
    # Check if any payment method is using it
    from service_fee_management.models import PaymentMethod
    linked_methods = PaymentMethod.objects.filter(default_account=old_mfs)
    
    if linked_methods.exists():
        print(f"\n⚠️  WARNING: Still linked to payment methods:")
        for pm in linked_methods:
            print(f"   - {pm.method_name}")
        print("\nCannot delete - please unlink first")
        return
    
    if entries_count > 0:
        print(f"\n⚠️  Account has {entries_count} transactions")
        print("Deactivating instead of deleting...")
        old_mfs.isActive = False
        old_mfs.save(update_fields=['isActive'])
        print(f"✅ Account deactivated (hidden from active list)")
    else:
        print(f"\n✅ Safe to delete (no transactions)")
        old_mfs.delete()
        print(f"✅ Account deleted")
    
    print("\n" + "="*80)
    print("✅ CLEANUP COMPLETE")
    print("="*80 + "\n")

if __name__ == '__main__':
    remove_old_mfs_account()
