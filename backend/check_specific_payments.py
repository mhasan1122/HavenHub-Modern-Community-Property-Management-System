#!/usr/bin/env python3
"""
Check specific payment transactions and their voucher entries
"""
import os
import sys
import django

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import VoucherEntry, VoucherEntryDetails
from service_fee_management.models import ServiceFeeBilling, PaymentMethod

def check_specific_payments():
    print("\n" + "="*100)
    print("🔍 CHECKING SPECIFIC PAYMENTS AND THEIR VOUCHERS")
    print("="*100 + "\n")
    
    payment_ids = [1, 2, 3, 4, 5, 6, 7]
    
    for pid in payment_ids:
        payment = ServiceFeeBilling.objects.filter(id=pid).first()
        
        if not payment:
            print(f"❌ Payment ID {pid} not found\n")
            continue
        
        print(f"{'='*100}")
        print(f"Payment ID: {pid}")
        print(f"Receipt ID: {payment.receipt_id}")
        print(f"Transaction ID: {payment.transaction_id}")
        print(f"Amount: {payment.total_paid}")
        print(f"Payment Method: {payment.payment_method or 'N/A'}")
        print(f"Payment Gateway: {payment.payment_gateway or 'N/A'}")
        
        # Try to get PaymentMethod object to see expected account
        pm = None
        if payment.payment_method:
            if payment.payment_method == 'bKash':
                pm = PaymentMethod.objects.filter(method_name='bKash').first()
            elif payment.payment_method == 'Visa':
                pm = PaymentMethod.objects.filter(method_name='Visa').first()
            elif payment.payment_method == 'Mastercard':
                pm = PaymentMethod.objects.filter(method_name='Mastercard').first()
        
        # Check payment_account_code field
        if payment.payment_account_code:
            print(f"Stored Account Code: {payment.payment_account_code} - {payment.payment_account_name or 'N/A'}")
        
        if pm and pm.default_account:
            print(f"Expected Account: {pm.default_account.accountCode} - {pm.default_account.accountName}")
        
        print(f"Created: {payment.created_at}")
        print(f"Notes: {payment.notes[:100] if payment.notes else 'N/A'}")
        
        # Find vouchers for this payment
        vouchers = VoucherEntry.objects.filter(referenceNumber=payment.receipt_id)
        
        if vouchers.exists():
            print(f"\n✅ Found {vouchers.count()} voucher(s):")
            for voucher in vouchers:
                print(f"\n   Voucher: {voucher.voucherNumber}")
                print(f"   Type: {voucher.voucherType.displayName if voucher.voucherType else 'N/A'}")
                print(f"   Date: {voucher.entryDate}")
                print(f"   Status: {voucher.status}")
                print(f"   Total: Debit={voucher.totalDebit}, Credit={voucher.totalCredit}")
                
                # Get entries
                details = VoucherEntryDetails.objects.filter(voucherEntry=voucher).order_by('lineNumber')
                
                if details.exists():
                    print(f"\n   📋 Voucher Entries:")
                    for detail in details:
                        if detail.debitAmount > 0:
                            print(f"      DEBIT  | {detail.account.accountCode} - {detail.account.accountName} | {detail.debitAmount}")
                        if detail.creditAmount > 0:
                            print(f"      CREDIT | {detail.account.accountCode} - {detail.account.accountName} | {detail.creditAmount}")
        else:
            print(f"\n⚠️  NO VOUCHER FOUND for receipt: {payment.receipt_id}")
            print(f"   This payment may not have accounting entries yet!")
        
        print()
    
    print("="*100 + "\n")

if __name__ == '__main__':
    check_specific_payments()
