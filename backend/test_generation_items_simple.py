#!/usr/bin/env python
"""Test script to verify ServiceFeeItem generation - Simple version without emoji"""
import django
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
os.environ['PYTHONIOENCODING'] = 'utf-8'
django.setup()

from service_fee_management.utils.service_fee_generator import generate_service_fees
from service_fee_management.models import ServiceFeeItem, ServiceFeePayment
import json

print("\n[TEST] Starting service fee generation with test payload...")
result = generate_service_fees(
    year=2026,
    month=1,
    unit_ids='86',
    service_fee_ids='6',
    bill_category_ids='13',
    force_regenerate=False
)

print('\n\n=== GENERATION RESULT ===')
print(json.dumps({
    'success': result.get('success'),
    'message': result.get('message'),
    'created_count': result.get('created_count'),
    'error': result.get('error')
}, indent=2))

# Check if items were created
print('\n\n=== CHECKING SERVICE FEE ITEMS ===')
payments = ServiceFeePayment.objects.filter(
    service_period_year=2026,
    service_period_month=1,
    unit_id=86,
    service_fee_id=6
)

print(f'Payments found: {payments.count()}')

if payments.exists():
    for payment in payments:
        items = payment.items.all()  # Using related_name
        print(f'\n[OK] Payment ID {payment.id}:')
        print(f'   Amount: BDT {payment.amount}')
        print(f'   Base Service: BDT {payment.base_service_amount}')
        print(f'   Additional Bills: BDT {payment.additional_bill_charges}')
        print(f'   Items count: {items.count()}')
        
        if items.count() > 0:
            print(f'\n   SERVICE FEE ITEMS:')
            for item in items:
                consumption_info = ""
                if item.consumption:
                    consumption_info = f' (Consumption: {item.consumption} {item.unit_of_measurement or "units"})'
                print(f'   - [{item.id}] {item.item_type}: {item.item_name} = BDT {item.amount}{consumption_info}')
        else:
            print(f'   [WARN] NO ITEMS FOUND!')
else:
    print('[ERROR] No payments found!')

print('\n\n=== ALL ITEMS IN DB FOR THIS PERIOD ===')
all_items = ServiceFeeItem.objects.filter(
    service_fee_payment__service_period_year=2026,
    service_fee_payment__service_period_month=1,
    service_fee_payment__unit_id=86,
    service_fee_payment__service_fee_id=6
)
print(f'Total items: {all_items.count()}')
for item in all_items:
    consumption_info = ""
    if item.consumption:
        consumption_info = f' (Consumption: {item.consumption} {item.unit_of_measurement or "units"})'
    print(f'- [{item.id}] {item.item_type}: {item.item_name} = BDT {item.amount}{consumption_info}')

print("\n\n[SUCCESS] Test completed!")
