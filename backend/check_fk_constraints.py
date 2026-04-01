import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Check foreign key constraints on accounts_journalentryline
    cursor.execute("""
        SELECT 
            CONSTRAINT_NAME,
            TABLE_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
        AND (TABLE_NAME = 'accounts_journalentryline' OR REFERENCED_TABLE_NAME = 'accounts_journalentry')
        AND CONSTRAINT_NAME != 'PRIMARY'
    """)
    
    print("\n=== Foreign Key Constraints ===")
    for row in cursor.fetchall():
        print(f"FK: {row[0]}")
        print(f"  Table: {row[1]}.{row[2]}")
        print(f"  References: {row[3]}.{row[4]}")
        print()
