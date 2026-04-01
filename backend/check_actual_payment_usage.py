#!/usr/bin/env python3
"""
Check actual payment transactions and which accounts were used
"""
import os
import sys
import django

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import Account, VoucherEntry, VoucherEntryDetails
from service_fee_management.models import ServiceFeePayment, PaymentMethod

def check_actual_usage():
    print("\n" + "="*100)
    print("🔍 CHECKING ACTUAL PAYMENT TRANSACTIONS")
    print("="*100 + "\n")
    
    # Check ServiceFeePayment records
    payments = ServiceFeePayment.objects.filter(payment_status='Completed').order_by('-created_at')[:10]
    
    print(f"📊 Last 10 Completed Payments:\n")
    
    for payment in payments:
        pm = payment.payment_method
        print(f"{'='*100}")
        print(f"Payment ID: {payment.id}")
        print(f"Unit: {payment.unit.unit_name if payment.unit else 'N/A'}")
        print(f"Amount: {payment.amount}")
        print(f"Payment Method: {pm.method_name if pm else 'N/A'} (ID: {pm.id if pm else 'N/A'})")
        print(f"Created: {payment.created_at}")
        
        # Check if voucher exists for this payment
        vouchers = VoucherEntry.objects.filter(referenceNumber=str(payment.batch_receipt_id))
        
        if vouchers.exists():
            print(f"\n✅ Voucher(s) found: {vouchers.count()}")
            for voucher in vouchers:
                print(f"   Voucher: {voucher.voucherNumber}")
                print(f"   Date: {voucher.entryDate}")
                print(f"   Status: {voucher.status}")
                
                # Get debit entries (payment received accounts)
                debit_entries = VoucherEntryDetails.objects.filter(
                    voucherEntry=voucher,
                    debitAmount__gt=0
                )
                
                if debit_entries.exists():
                    print(f"\n   💰 Debit Entries (Money Received):")
                    for entry in debit_entries:
                        print(f"      {entry.account.accountCode} - {entry.account.accountName}: {entry.debitAmount}")
                
                credit_entries = VoucherEntryDetails.objects.filter(
                    voucherEntry=voucher,
                    creditAmount__gt=0
                )
                
                if credit_entries.exists():
                    print(f"\n   📤 Credit Entries:")
                    for entry in credit_entries:
                        print(f"      {entry.account.accountCode} - {entry.account.accountName}: {entry.creditAmount}")
        else:
            print(f"\n⚠️  No voucher found")
        
        print()
    
    # Check which accounts have actual transactions
    print("\n" + "="*100)
    print("💳 ACCOUNTS WITH ACTUAL VOUCHER ENTRIES (Under CCE)")
    print("="*100 + "\n")
    
    cce = Account.objects.filter(accountCode='1110').first()
    if cce:
        child_accounts = Account.objects.filter(parentAccount=cce, isActive=True).order_by('accountCode')
        
        for acc in child_accounts:
            # Count voucher entries
            debit_count = VoucherEntryDetails.objects.filter(account=acc, debitAmount__gt=0).count()
            credit_count = VoucherEntryDetails.objects.filter(account=acc, creditAmount__gt=0).count()
            total_entries = debit_count + credit_count
            
            if total_entries > 0:
                print(f"✅ {acc.accountCode} - {acc.accountName}")
                print(f"   Debit Entries: {debit_count}")
                print(f"   Credit Entries: {credit_count}")
                print(f"   Current Balance: {acc.currentBalance}")
                print()
            else:
                print(f"⚪ {acc.accountCode} - {acc.accountName} (No transactions)")
    
    print("="*100 + "\n")

if __name__ == '__main__':
    check_actual_usage()
