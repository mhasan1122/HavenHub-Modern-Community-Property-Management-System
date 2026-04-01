#!/usr/bin/env python
"""
Analyze all payments for the unit to understand the structure
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeBilling, ServiceFeePayment

# Find all billings for January 2026
billings = ServiceFeeBilling.objects.filter(
    transaction_id__in=['TXN-202602-8EA03194', 'TXN-202602-2A992594', 'TXN-202602-FF086421']
).order_by('created_at')

print(f"\n{'='*80}")
print(f"ALL BILLING RECORDS FOR THE UNIT")
print(f"{'='*80}\n")

for billing in billings:
    print(f"Transaction ID: {billing.transaction_id}")
    print(f"  Receipt ID: {billing.receipt_id}")
    print(f"  Billing Amount: {billing.billing_amount}")
    print(f"  Total Paid: {billing.total_paid}")
    print(f"  Payment Result Status: {billing.payment_result_status}")
    print(f"  Payment Type: {billing.payment_type}")
    print(f"  Created: {billing.created_at}")
    
    if billing.servicefeepaymentid:
        payment = billing.servicefeepaymentid
        print(f"  Related ServiceFeePayment:")
        print(f"    - ID: {payment.id}")
        print(f"    - Amount: {payment.amount}")
        print(f"    - Remaining: {payment.remaining_amount}")
        print(f"    - Service Period: {payment.service_period_month}/{payment.service_period_year}")
        print(f"    - Service Status: {payment.service_status}")
    print()

print(f"{'='*80}")
print("ANALYSIS:")
print("  If these are separate bills for different periods, each has its own status")
print("  If they're payments toward the SAME bill, we need to check the cumulative total")
print(f"{'='*80}\n")
