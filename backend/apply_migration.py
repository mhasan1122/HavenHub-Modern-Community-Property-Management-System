#!/usr/bin/env python
"""
Script to apply ServiceFeePaymentDetail migration
Run: python apply_migration.py
"""

import os
import sys
import django

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.management import call_command

print("\n" + "="*60)
print("Applying ServiceFeePaymentDetail Migration")
print("="*60)

try:
    # Run makemigrations first to ensure everything is detected
    print("\n1. Running makemigrations...")
    call_command('makemigrations', 'service_fee_management', verbosity=2)
    
    # Apply migrations
    print("\n2. Running migrate...")
    call_command('migrate', 'service_fee_management', verbosity=2)
    
    print("\n" + "="*60)
    print("✅ Migration applied successfully!")
    print("="*60)
    
    # Verify the table exists
    print("\n3. Verifying table creation...")
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_payment_detail'
        """)
        result = cursor.fetchone()
        if result:
            print(f"✅ Table exists: {result[0]}")
        else:
            print("❌ Table not found!")
    
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
