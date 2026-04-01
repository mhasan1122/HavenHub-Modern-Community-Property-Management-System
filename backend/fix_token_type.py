#!/usr/bin/env python
"""
Quick fix script to add token_type column to notifications_devicetoken table
Run this if migration doesn't work: python fix_token_type.py
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

try:
    django.setup()
except Exception as e:
    print(f"Error setting up Django: {e}")
    print("\nMake sure you're in the backend directory and Django is installed.")
    sys.exit(1)

from django.db import connection

def fix_token_type():
    print("=" * 60)
    print("Fixing token_type column in notifications_devicetoken table")
    print("=" * 60)
    print()
    
    try:
        with connection.cursor() as cursor:
            # Check if column exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'notifications_devicetoken' 
                AND COLUMN_NAME = 'token_type'
            """)
            column_exists = cursor.fetchone()[0] > 0
            
            if not column_exists:
                print("❌ token_type column NOT found")
                print("📝 Adding token_type column...")
                cursor.execute("""
                    ALTER TABLE notifications_devicetoken 
                    ADD COLUMN token_type VARCHAR(10) DEFAULT 'expo' NOT NULL
                """)
                print("✅ Added token_type column")
            else:
                print("✅ token_type column already exists")
            
            # Check if index exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'notifications_devicetoken' 
                AND INDEX_NAME = 'notificatio_token_t_085be6_idx'
            """)
            index_exists = cursor.fetchone()[0] > 0
            
            if not index_exists:
                print("❌ token_type index NOT found")
                print("📝 Adding token_type index...")
                cursor.execute("""
                    CREATE INDEX notificatio_token_t_085be6_idx 
                    ON notifications_devicetoken (token_type, is_active)
                """)
                print("✅ Added token_type index")
            else:
                print("✅ token_type index already exists")
            
            print()
            print("=" * 60)
            print("✅ Migration complete!")
            print("=" * 60)
            print()
            print("Next steps:")
            print("1. Restart your Django server")
            print("2. Test device token registration")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    fix_token_type()
