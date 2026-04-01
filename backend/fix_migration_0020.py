#!/usr/bin/env python
"""
Script to fix migration 0020 issues on any PC
This script handles the case where columns don't exist in the database
"""
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from django.core.management import call_command


def check_database_schema():
    """Check the current database schema"""
    with connection.cursor() as cursor:
        # Check which columns exist in the ServiceFeePayment table
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_management_servicefeepayment'
            ORDER BY COLUMN_NAME
        """)
        
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        print("Current ServiceFeePayment table columns:")
        for col in sorted(existing_columns):
            print(f"  - {col}")
        
        # Fields that migration 0020 tries to remove
        fields_to_remove = [
            'original_amount',
            'remaining_amount', 
            'service_status',
            'service_period_month',
            'service_period_year',
            'due_date'
        ]
        
        print(f"\nFields that migration 0020 wants to remove:")
        for field in fields_to_remove:
            status = "EXISTS" if field in existing_columns else "NOT EXISTS"
            print(f"  - {field}: {status}")
        
        return existing_columns, fields_to_remove


def fix_migration_0020():
    """Fix migration 0020 by removing only existing columns"""
    with connection.cursor() as cursor:
        existing_columns, fields_to_remove = check_database_schema()
        
        print(f"\nFixing migration 0020...")
        
        # Remove only the fields that exist
        for field in fields_to_remove:
            if field in existing_columns:
                print(f"Removing field: {field}")
                try:
                    cursor.execute(f"ALTER TABLE service_fee_management_servicefeepayment DROP COLUMN {field}")
                    print(f"  ✅ Successfully removed: {field}")
                except Exception as e:
                    print(f"  ❌ Could not remove {field}: {e}")
            else:
                print(f"  ⏭️  Field {field} does not exist, skipping...")
        
        print(f"\nMigration 0020 fix completed!")


def fake_migration_0020():
    """Alternative: Fake migration 0020 if manual fix doesn't work"""
    print("Faking migration 0020...")
    try:
        call_command('migrate', 'service_fee_management', '0020', '--fake')
        print("✅ Successfully faked migration 0020")
        return True
    except Exception as e:
        print(f"❌ Could not fake migration 0020: {e}")
        return False


def main():
    """Main function"""
    print("=== Migration 0020 Fix Script ===")
    print("This script fixes the 'Can't DROP column' error in migration 0020")
    
    try:
        # Check current schema
        existing_columns, fields_to_remove = check_database_schema()
        
        # Check if any of the fields exist
        existing_fields_to_remove = [f for f in fields_to_remove if f in existing_columns]
        
        if existing_fields_to_remove:
            print(f"\nFound {len(existing_fields_to_remove)} fields that need to be removed:")
            for field in existing_fields_to_remove:
                print(f"  - {field}")
            
            # Try to fix the migration
            fix_migration_0020()
            
            # Now try to run the migration
            print(f"\nTrying to run migration 0020...")
            try:
                call_command('migrate', 'service_fee_management', '0020')
                print("✅ Migration 0020 completed successfully!")
            except Exception as e:
                print(f"❌ Migration 0020 still failed: {e}")
                print("Trying to fake the migration...")
                if fake_migration_0020():
                    print("✅ Migration 0020 faked successfully!")
                else:
                    print("❌ Could not fix migration 0020")
                    return False
        else:
            print(f"\nNo fields need to be removed. Faking migration 0020...")
            if fake_migration_0020():
                print("✅ Migration 0020 faked successfully!")
            else:
                print("❌ Could not fake migration 0020")
                return False
        
        # Try to run all migrations
        print(f"\nRunning all migrations...")
        try:
            call_command('migrate')
            print("✅ All migrations completed successfully!")
            return True
        except Exception as e:
            print(f"❌ Some migrations failed: {e}")
            return False
            
    except Exception as e:
        print(f"\n❌ Error during migration fix: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 Migration fix completed successfully!")
        print("You can now run: python manage.py migrate")
    else:
        print("\n💥 Migration fix failed. Please check the errors above.")
    sys.exit(0 if success else 1)
