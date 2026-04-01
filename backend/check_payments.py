#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeePayment
from towers.models import Unit

def check_payments():
    print("=== Checking Units ===")
    units = Unit.objects.filter(unit_name__icontains='1B')
    print(f'Units found: {len(units)}')
    
    for unit in units:
        print(f'Unit: {unit.unit_name}, Tower: {unit.floor.tower.tower_name}, ID: {unit.id}')
    
    print("\n=== Checking Payments ===")
    payments = ServiceFeePayment.objects.filter(unit__unit_name__icontains='1B')
    print(f'Total payments for 1B units: {len(payments)}')
    
    for p in payments:
        print(f'Payment ID: {p.id}, Unit: {p.unit.unit_name}, Tower: {p.unit.floor.tower.tower_name}, Amount: {p.amount}, Date: {p.payment_date}')
    
    print("\n=== Checking All Payments ===")
    all_payments = ServiceFeePayment.objects.all()
    print(f'Total payments in database: {len(all_payments)}')
    
    for p in all_payments[:10]:  # Show first 10
        print(f'Payment ID: {p.id}, Unit: {p.unit.unit_name}, Tower: {p.unit.floor.tower.tower_name}, Amount: {p.amount}, Date: {p.payment_date}')

if __name__ == '__main__':
    check_payments()

