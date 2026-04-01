#!/usr/bin/env python
"""
Test script to verify ServiceFeeGenerationConfig is properly configured and migration is applied
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from service_fee_management.models import ServiceFeeGenerationConfig, ServiceFeePayment
from django.db import connection

# Test 1: Check if the table exists
def check_table_exists():
    with connection.cursor() as cursor:
        try:
            cursor.execute("SELECT COUNT(*) FROM service_fee_management_servicefeegenerationconfig")
            count = cursor.fetchone()[0]
            print(f"✅ Table 'service_fee_management_servicefeegenerationconfig' exists with {count} records")
            return True
        except Exception as e:
            print(f"❌ Error checking table: {e}")
            return False

# Test 2: Check if ServiceFeePayment has generation_config field
def check_generation_config_field():
    try:
        # Try to fetch a payment and access generation_config
        payment = ServiceFeePayment.objects.first()
        if payment:
            config = payment.generation_config
            print(f"✅ ServiceFeePayment.generation_config field exists")
            return True
        else:
            print("⚠️  No ServiceFeePayment records found (but field exists)")
            return True
    except Exception as e:
        print(f"❌ Error accessing generation_config field: {e}")
        return False

# Test 3: Check model definition
def check_model_definition():
    try:
        from service_fee_management.models import ServiceFeeGenerationConfig
        fields = [f.name for f in ServiceFeeGenerationConfig._meta.get_fields()]
        print(f"✅ ServiceFeeGenerationConfig model loaded with fields: {', '.join(fields[:5])}...")
        return True
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return False

# Run all tests
if __name__ == '__main__':
    print("\n=== Testing ServiceFeeGenerationConfig Setup ===\n")
    
    results = [
        ("Model Definition", check_model_definition()),
        ("Table Existence", check_table_exists()),
        ("Field Access", check_generation_config_field()),
    ]
    
    print("\n=== Summary ===")
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(passed for _, passed in results)
    if all_passed:
        print("\n🎉 All tests passed! ServiceFeeGenerationConfig is properly configured.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check errors above.")
        sys.exit(1)
