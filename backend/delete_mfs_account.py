#!/usr/bin/env python3
"""
Transfer transactions from old MFS account to individual accounts, then delete it
"""
import os
import sys
import django

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account, VoucherEntryDetails
from service_fee_management.models import PaymentMethod

def transfer_and_delete():
    print("\n" + "="*100)
    print("🔄 TRANSFERRING TRANSACTIONS AND DELETING OLD MFS ACCOUNT")
    print("="*100 + "\n")
    
    # Find the old MFS account
    old_mfs = Account.objects.filter(accountCode='1125').first()
    
    if not old_mfs:
        print("❌ Account 1125 not found - may already be deleted")
        return
    
    print(f"Found: {old_mfs.accountCode} - {old_mfs.accountName}")
    print(f"Active: {old_mfs.isActive}")
    
    # Get all voucher entries using this account
    entries = VoucherEntryDetails.objects.filter(account=old_mfs)
    print(f"\n📋 Found {entries.count()} voucher entries\n")
    
    if entries.exists():
        # Get individual accounts
        bkash_account = Account.objects.filter(accountCode='1130').first()
        
        print("Transferring transactions to bKash account (1130)...")
        
        for entry in entries:
            old_account = entry.account.accountCode
            entry.account = bkash_account
            entry.save(update_fields=['account'])
            print(f"  ✅ Moved entry from voucher {entry.voucherEntry.voucherNumber}")
        
        print(f"\n✅ Transferred {entries.count()} entries to bKash account")
    
    # Now delete the account
    print(f"\n🗑️  Deleting account {old_mfs.accountCode}...")
    old_mfs.delete()
    print(f"✅ Account deleted permanently")
    
    print("\n" + "="*100)
    print("✅ COMPLETE - Account 1125 removed")
    print("="*100 + "\n")

if __name__ == '__main__':
    transfer_and_delete()
