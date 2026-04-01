#!/usr/bin/env python
"""Test if ServiceFeeItem model has the newly added fields"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeItem

print("Testing ServiceFeeItem model fields...")
print()

# Get all fields
all_fields = [f.name for f in ServiceFeeItem._meta.get_fields()]
print(f"Total fields in ServiceFeeItem: {len(all_fields)}")
print()

# Check for the consumption fields
consumption_fields = [
    'unit_of_measurement',
    'price_per_unit',
    'previous_reading',
    'current_reading',
    'consumption'
]

print("Checking consumption fields:")
for field_name in consumption_fields:
    if field_name in all_fields:
        field_obj = ServiceFeeItem._meta.get_field(field_name)
        print(f"  ✅ {field_name}: {field_obj.__class__.__name__}")
    else:
        print(f"  ❌ {field_name}: NOT FOUND")

print()
print("All fields in model:")
for field in all_fields:
    print(f"  - {field}")
