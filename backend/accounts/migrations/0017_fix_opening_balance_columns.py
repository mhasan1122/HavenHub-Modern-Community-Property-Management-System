# Generated migration to fix opening balance columns
# This migration handles the discrepancy between model definition and actual database schema

from django.db import migrations, models


def fix_opening_balance_columns(apps, schema_editor):
    """
    Use raw SQL to fix the opening balance columns:
    1. Add openingDebit and openingCredit columns if they don't exist
    2. Migrate data from openingBalance to these columns
    3. Drop unnecessary columns
    """
    if schema_editor.connection.vendor != 'mysql':
        return
    
    with schema_editor.connection.cursor() as cursor:
        # Check if openingDebit column exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'accounts_account' 
            AND COLUMN_NAME = 'openingDebit'
        """)
        opening_debit_exists = cursor.fetchone()[0] > 0
        
        # Add openingDebit column if it doesn't exist
        if not opening_debit_exists:
            cursor.execute("""
                ALTER TABLE accounts_account 
                ADD COLUMN openingDebit DECIMAL(15,2) NOT NULL DEFAULT 0
            """)
            print("Added openingDebit column")
        
        # Check if old openingBalanceDebit/Credit columns exist (only migrate if both exist)
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'accounts_account' 
            AND COLUMN_NAME IN ('openingBalanceDebit', 'openingBalanceCredit')
        """)
        old_columns_count = cursor.fetchone()[0]
        if old_columns_count == 2:
            # Migrate data from old columns to new column
            # For debit accounts (asset, expense): openingBalance = openingBalanceDebit - openingBalanceCredit
            # For credit accounts (liability, equity, revenue): openingBalance = openingBalanceCredit - openingBalanceDebit
            cursor.execute("""
                UPDATE accounts_account 
                SET openingBalance = CASE 
                    WHEN accountType IN ('asset', 'expense') THEN 
                        COALESCE(openingBalanceDebit, 0) - COALESCE(openingBalanceCredit, 0)
                    ELSE 
                        COALESCE(openingBalanceCredit, 0) - COALESCE(openingBalanceDebit, 0)
                END
            """)
            print("Migrated opening balance data")
        else:
            print("Skipping data migration: openingBalanceDebit/openingBalanceCredit columns not present")
        
        # Drop old columns if they exist
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'accounts_account' 
            AND COLUMN_NAME = 'openingBalanceDebit'
        """)
        if cursor.fetchone()[0] > 0:
            cursor.execute("ALTER TABLE accounts_account DROP COLUMN openingBalanceDebit")
            print("Dropped openingBalanceDebit column")
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'accounts_account' 
            AND COLUMN_NAME = 'openingBalanceCredit'
        """)
        if cursor.fetchone()[0] > 0:
            cursor.execute("ALTER TABLE accounts_account DROP COLUMN openingBalanceCredit")
            print("Dropped openingBalanceCredit column")
        
        # Drop accountCategory column if it exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'accounts_account' 
            AND COLUMN_NAME = 'accountCategory'
        """)
        if cursor.fetchone()[0] > 0:
            cursor.execute("ALTER TABLE accounts_account DROP COLUMN accountCategory")
            print("Dropped accountCategory column")
        
        # Drop isGroup column if it exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'accounts_account' 
            AND COLUMN_NAME = 'isGroup'
        """)
        if cursor.fetchone()[0] > 0:
            cursor.execute("ALTER TABLE accounts_account DROP COLUMN isGroup")
            print("Dropped isGroup column")


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_alter_defaultaccounthead_defaultentrytype'),
    ]

    operations = [
        migrations.RunPython(
            fix_opening_balance_columns,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
