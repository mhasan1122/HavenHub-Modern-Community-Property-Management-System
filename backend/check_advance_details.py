#!/usr/bin/env python
"""Check detailed payment history"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import AdvancePayment, ServiceFeeBilling, PaymentMethod

print('=== DETAILED ADVANCE PAYMENT ANALYSIS ===\n')

advances = AdvancePayment.objects.all().order_by('-id')[:5]
for adv in advances:
    pm_name = adv.payment_method.method_name if adv.payment_method else 'NULL'
    print(f'Advance ID: {adv.id}')
    print(f'  Amount: {adv.amount}')
    print(f'  Payment Method: {pm_name} (ID: {adv.payment_method_id})')
    print(f'  Created: {adv.created_at}')
    print(f'  Notes: {adv.notes}')
    
    # Find related billing records
    billings = ServiceFeeBilling.objects.filter(advance_payment_id=adv.id)
    print(f'  Related Billing Records: {billings.count()}')
    for billing in billings:
        b_pm = billing.payment_method.method_name if billing.payment_method else 'NULL'
        print(f'    - Billing ID: {billing.id}, Amount: {billing.total_paid}, PM: {b_pm}, Type: {billing.payment_type}')
    print()
