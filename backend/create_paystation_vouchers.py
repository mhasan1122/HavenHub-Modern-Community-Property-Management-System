#!/usr/bin/env python3
"""
Create vouchers for existing PayStation payments that don't have vouchers yet
"""
import os
import sys
import django

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import VoucherEntry
from service_fee_management.models import ServiceFeeBilling, PaymentMethod
from service_fee_management.utils.voucher_generator import create_payment_voucher
from towers.models import Unit

def create_missing_vouchers():
    print("\n" + "="*100)
    print("🔧 CREATING VOUCHERS FOR PAYSTATION PAYMENTS")
    print("="*100 + "\n")
    
    # Get PayStation payments without vouchers
    paystation_payments = ServiceFeeBilling.objects.filter(
        payment_gateway='paystation'
    ).order_by('id')
    
    print(f"📊 Found {paystation_payments.count()} PayStation payments\n")
    
    created_count = 0
    skipped_count = 0
    error_count = 0
    
    for billing in paystation_payments:
        print(f"{'='*100}")
        print(f"Processing Payment ID: {billing.id}")
        print(f"Receipt ID: {billing.receipt_id}")
        print(f"Amount: {billing.total_paid}")
        print(f"Payment Method: {billing.payment_method.method_name if billing.payment_method else billing.other_method_name}")
        print(f"Transaction ID: {billing.transaction_id}")
        
        # Check if voucher already exists
        existing_voucher = VoucherEntry.objects.filter(referenceNumber=billing.receipt_id).first()
        
        if existing_voucher:
            print(f"✅ Voucher already exists: {existing_voucher.voucherNumber}")
            skipped_count += 1
            print()
            continue
        
        # Get unit
        unit = None
        if billing.servicefeepaymentid:
            unit = billing.servicefeepaymentid.unit
        elif billing.advance_payment:
            unit = Unit.objects.filter(id=billing.advance_payment.unit_id).first()
        
        if not unit:
            print(f"⚠️ No unit found - skipping")
            error_count += 1
            print()
            continue
        
        print(f"Unit: {unit.unit_name}")
        
        # Get payment method
        payment_method_id = None
        method_name = "N/A"
        
        if billing.payment_method:
            payment_method_id = billing.payment_method.id
            method_name = billing.payment_method.method_name
        elif billing.other_method_name:
            # Try to find or create payment method
            pm = PaymentMethod.objects.filter(method_name=billing.other_method_name).first()
            if pm:
                payment_method_id = pm.id
                method_name = pm.method_name
        
        print(f"Payment Method ID: {payment_method_id}, Name: {method_name}")
        
        # Create voucher
        try:
            voucher_result = create_payment_voucher(
                billing_records=[billing],
                total_amount=float(billing.total_paid),
                payment_method_id=payment_method_id,
                member=billing.created_by,
                unit=unit,
                batch_receipt_id=billing.receipt_id,
                notes=f"PayStation payment ({method_name}) - {billing.transaction_id or ''}",
                entry_date=billing.payment_date.date() if billing.payment_date else None
            )
            
            if voucher_result.get('success'):
                voucher_id = voucher_result.get('voucher_id')
                voucher = VoucherEntry.objects.get(id=voucher_id)
                print(f"✅ Voucher created: {voucher.voucherNumber}")
                created_count += 1
            else:
                print(f"❌ Voucher creation failed: {voucher_result.get('message')}")
                error_count += 1
                
        except Exception as e:
            print(f"❌ Error creating voucher: {str(e)}")
            import traceback
            traceback.print_exc()
            error_count += 1
        
        print()
    
    print("="*100)
    print(f"✅ SUMMARY:")
    print(f"   Created: {created_count}")
    print(f"   Skipped (already exists): {skipped_count}")
    print(f"   Errors: {error_count}")
    print("="*100 + "\n")

if __name__ == '__main__':
    create_missing_vouchers()
