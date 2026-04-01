#!/usr/bin/env python
"""
Script to update existing AdvancePayment records with payment_method 
from their corresponding ServiceFeeBilling records
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import AdvancePayment, ServiceFeeBilling

print('=== UPDATING OLD ADVANCE PAYMENTS WITH PAYMENT METHOD ===')
advances = AdvancePayment.objects.filter(payment_method__isnull=True)
print(f'Found {advances.count()} advance payments without payment_method\n')

updated_count = 0
for adv in advances:
    # Try to find the billing record that created this advance
    billing = ServiceFeeBilling.objects.filter(
        advance_payment_id=adv.id, 
        payment_type='advance_payment'
    ).first()
    
    if billing and billing.payment_method:
        adv.payment_method = billing.payment_method
        adv.save()
        print(f'✅ Updated Advance ID {adv.id} (Amount: {adv.amount}) with payment method: {billing.payment_method.method_name}')
        updated_count += 1
    else:
        print(f'⚠️  No billing record with payment_method found for Advance ID {adv.id}')

print(f'\n=== SUMMARY: Updated {updated_count} records ===\n')

print('=== VERIFICATION: All Advance Payments ===')
advances = AdvancePayment.objects.all().order_by('-id')[:10]
for adv in advances:
    pm = adv.payment_method.method_name if adv.payment_method else 'NULL'
    print(f'ID: {adv.id}, Amount: {adv.amount}, Payment Method: {pm}, Created: {adv.created_at}')
