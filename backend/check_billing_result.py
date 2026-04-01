#!/usr/bin/env python
"""
Check payment_result values and payment_result_display
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment, ServiceFeeBilling

# Find payments by checking billings first
billings = ServiceFeeBilling.objects.filter(
    transaction_id__in=['TXN-202602-8EA03194', 'TXN-202602-2A992594', 'TXN-202602-FF086421']
).order_by('created_at')

print("\n" + "="*80)
print("PAYMENT RESULT STATUS CHECK")
print("="*80 + "\n")

for billing in billings:
    print(f"Billing Transaction ID: {billing.transaction_id}")
    print(f"  Receipt ID: {billing.receipt_id}")
    print(f"  Billing payment_result_status: {billing.payment_result_status}")
    
    # Check related payment
    if billing.servicefeepaymentid:
        payment = billing.servicefeepaymentid
        print(f"  Related ServiceFeePayment:")
        print(f"    - Payment ID: {payment.id}")
        print(f"    - payment_result_status: {payment.payment_result_status}")
        print(f"    - payment_result_display: {payment.payment_result_display}")
        print(f"    - payment_status: {payment.payment_status}")
        print(f"    - service_status: {payment.service_status}")
    print()

print("="*80)
print("EXPECTED:")
print("  When payment_result_status='full' → payment_result_display='Paid'")
print("  When payment_result_status='partial' → payment_result_display='Partial'")
print("="*80 + "\n")
