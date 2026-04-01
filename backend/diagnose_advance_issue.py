#!/usr/bin/env python
"""
Comprehensive diagnostic script to check advance payment application
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from decimal import Decimal
from service_fee_management.models import ServiceFeePayment, AdvancePayment, ServiceFeeBilling
from service_fee_management.utils.payment_processor import apply_advance_to_bill
from django.db import models
import logging

logger = logging.getLogger(__name__)

print("\n" + "="*80)
print("ADVANCE PAYMENT DIAGNOSTIC TEST")
print("="*80)

# Step 1: Check bills for January 2026
print("\n[STEP 1] Checking bills for January 2026...")
bills = ServiceFeePayment.objects.filter(
    service_period_year=2026,
    service_period_month=1
)
print(f"Found {bills.count()} bill(s)")
for bill in bills:
    print(f"  📋 Bill ID: {bill.id}")
    print(f"     Reference: {bill.billing_reference}")
    print(f"     Amount: ₹{bill.amount}")
    print(f"     Status: {bill.payment_status}")
    print(f"     Owner: {bill.owner_id}")
    print(f"     Unit: {bill.unit_id}")
    print(f"     Account Holder Type: {bill.account_holder_type}")
    print(f"     Account Holder ID: {bill.account_holder_id}")
    
    # Check if bill has any applied advances
    applied_advances = ServiceFeeBilling.objects.filter(
        service_fee_payment=bill
    )
    if applied_advances.exists():
        total_paid = applied_advances.aggregate(models.Sum('total_paid'))['total_paid__sum'] or Decimal('0')
        print(f"     ✅ Has {applied_advances.count()} billing transaction(s), Total Paid: ₹{total_paid}")
    else:
        print(f"     ❌ NO billing transactions (advance not applied)")

# Step 2: Check available advances
print("\n[STEP 2] Checking available advances...")
advances = AdvancePayment.objects.filter(status='available')
print(f"Found {advances.count()} available advance(s)")
for advance in advances:
    print(f"  💰 Advance ID: {advance.id}")
    print(f"     Amount: ₹{advance.amount}")
    print(f"     Remaining: ₹{advance.remaining_amount}")
    print(f"     Status: {advance.status}")
    print(f"     Unit ID: {advance.unit_id}")
    print(f"     Account Holder Type: {advance.account_holder_type}")
    print(f"     Account Holder ID: {advance.account_holder_id}")

# Step 3: Manual test of apply_advance_to_bill
print("\n[STEP 3] Testing apply_advance_to_bill function...")
if bills.exists():
    bill = bills.first()
    print(f"Testing with bill {bill.id}...")
    
    try:
        result = apply_advance_to_bill(
            payment=bill,
            account_holder_type=bill.account_holder_type,
            account_holder_id=bill.account_holder_id
        )
        print(f"\n✅ Function executed successfully!")
        print(f"   Result: {result}")
        
        # Refresh bill from database
        bill.refresh_from_db()
        print(f"\n   After applying advance:")
        print(f"   - Bill Status: {bill.payment_status}")
        
        # Check billing transactions
        billings = ServiceFeeBilling.objects.filter(service_fee_payment=bill)
        if billings.exists():
            print(f"   - Billing Transactions: {billings.count()}")
            for billing in billings:
                print(f"     • Transaction ID: {billing.id}, Paid: ₹{billing.total_paid}, Type: {billing.payment_type}")
        else:
            print(f"   - ❌ No billing transactions created")
            
    except Exception as e:
        print(f"\n❌ Function failed with error:")
        print(f"   {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
else:
    print("❌ No bills found to test")

# Step 4: Check import paths
print("\n[STEP 4] Checking imports in payment_processor.py...")
try:
    from service_fee_management.utils.payment_processor import apply_advance_to_bill
    print("✅ apply_advance_to_bill imported successfully")
except ImportError as e:
    print(f"❌ Import failed: {e}")

# Step 5: Check service_fee_generator code
print("\n[STEP 5] Checking service_fee_generator.py for auto-payment logic...")
try:
    with open('service_fee_management/utils/service_fee_generator.py', 'r') as f:
        content = f.read()
        if 'auto_payment_task' in content:
            print("✅ auto_payment_task is referenced in service_fee_generator.py")
            # Find the relevant line numbers
            lines = content.split('\n')
            for i, line in enumerate(lines, 1):
                if 'auto_payment_task' in line:
                    print(f"   Line {i}: {line.strip()}")
        else:
            print("❌ auto_payment_task NOT found in service_fee_generator.py")
except Exception as e:
    print(f"❌ Could not read file: {e}")

print("\n" + "="*80)
print("DIAGNOSTIC TEST COMPLETE")
print("="*80 + "\n")
