#!/usr/bin/env python
"""
Check remaining_amount for specific payments
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment
from decimal import Decimal

# Find payments for unit 105 in January 2026
unit_id = 105
payments = ServiceFeePayment.objects.filter(
    unit_id=unit_id,
    service_period_month=1,
    service_period_year=2026
).order_by('created_at')

print(f"\n{'='*80}")
print(f"PAYMENT DETAILS FOR UNIT {unit_id} - JANUARY 2026")
print(f"{'='*80}\n")

for idx, payment in enumerate(payments, 1):
    print(f"Payment #{idx}:")
    print(f"  Transaction ID: {payment.id}")
    print(f"  Amount Paid: {payment.amount}")
    print(f"  Remaining Amount: {payment.remaining_amount}")
    print(f"  Payment Status: {payment.payment_status}")
    print(f"  Service Status: {payment.service_status}")
    print(f"  Payment Result: {payment.payment_result_status}")
    print(f"  Created At: {payment.created_at}")
    print(f"  Total Bill Amount: {payment.base_service_amount + payment.additional_bill_charges}")
    print(f"  Total Paid: {payment.total_paid}")
    
    # Get billing records for this payment
    billings = payment.billing_records.all()
    if billings:
        print(f"  Billing Records:")
        for billing in billings:
            print(f"    - ID: {billing.id}, Receipt: {billing.receipt_id}, TXN: {billing.transaction_id}")
    print()

# Summary
print(f"\n{'='*80}")
print("EXPECTED BEHAVIOR:")
print("  First payment (13,200): remaining_amount should be 600")
print("  Second payment (600): remaining_amount should be 0")
print(f"{'='*80}\n")
