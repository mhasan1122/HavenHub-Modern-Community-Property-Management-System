#!/usr/bin/env python
"""
Find payments with amounts 13200 and 600
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment
from decimal import Decimal

# Find payments with these amounts
print("\n" + "="*80)
print("SEARCHING FOR PAYMENTS WITH AMOUNT 13200 OR 600")
print("="*80 + "\n")

payments_13200 = ServiceFeePayment.objects.filter(amount=Decimal('13200')).order_by('-created_at')[:5]
payments_600 = ServiceFeePayment.objects.filter(amount=Decimal('600')).order_by('-created_at')[:5]

print(f"Found {payments_13200.count()} payments with amount 13200")
print(f"Found {payments_600.count()} payments with amount 600\n")

print("Payments with amount 13,200:")
print("-" * 80)
for payment in payments_13200:
    print(f"  ID: {payment.id}")
    print(f"  Unit ID: {payment.unit_id}")
    print(f"  Unit: {payment.unit.unit_name if payment.unit else 'N/A'}")
    print(f"  Tower: {payment.unit.floor.tower.tower_name if payment.unit and payment.unit.floor and payment.unit.floor.tower else 'N/A'}")
    print(f"  Amount: {payment.amount}")
    print(f"  Remaining: {payment.remaining_amount}")
    print(f"  Payment Status: {payment.payment_status}")
    print(f"  Service Status: {payment.service_status}")
    print(f"  Payment Result: {payment.payment_result_status}")
    print(f"  Service Period: {payment.service_period_month}/{payment.service_period_year}")
    print(f"  Created: {payment.created_at}")
    
    # Check for billing records
    billings = payment.billing_records.all()
    if billings.exists():
        print(f"  Billing Records:")
        for billing in billings:
            print(f"    - Receipt: {billing.receipt_id}, TXN: {billing.transaction_id}")
    print()

print("\nPayments with amount 600:")
print("-" * 80)
for payment in payments_600:
    print(f"  ID: {payment.id}")
    print(f"  Unit ID: {payment.unit_id}")
    print(f"  Unit: {payment.unit.unit_name if payment.unit else 'N/A'}")
    print(f"  Tower: {payment.unit.floor.tower.tower_name if payment.unit and payment.unit.floor and payment.unit.floor.tower else 'N/A'}")
    print(f"  Amount: {payment.amount}")
    print(f"  Remaining: {payment.remaining_amount}")
    print(f"  Payment Status: {payment.payment_status}")
    print(f"  Service Status: {payment.service_status}")
    print(f"  Payment Result: {payment.payment_result_status}")
    print(f"  Service Period: {payment.service_period_month}/{payment.service_period_year}")
    print(f"  Created: {payment.created_at}")
    
    # Check for billing records
    billings = payment.billing_records.all()
    if billings.exists():
        print(f"  Billing Records:")
        for billing in billings:
            print(f"    - Receipt: {billing.receipt_id}, TXN: {billing.transaction_id}")
    print()

print("\n" + "="*80)
print("EXPECTED:")
print("  Payment with 13,200 should have remaining_amount = 600")
print("  Payment with 600 should have remaining_amount = 0")
print("="*80 + "\n")
