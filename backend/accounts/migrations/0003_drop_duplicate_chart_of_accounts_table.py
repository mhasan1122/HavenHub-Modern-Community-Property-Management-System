# Generated migration to drop duplicate accounts table
# The correct table is accounts_account

from django.db import migrations


def drop_duplicate_table(apps, schema_editor):
    """
    Drop the duplicate accounts table if it exists.
    The correct table is accounts_account.
    """
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        with schema_editor.connection.cursor() as cursor:
            # Check if the duplicate table exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'accounts'
            """)
            
            if cursor.fetchone()[0] > 0:
                # Check if table has any data before dropping
                cursor.execute("SELECT COUNT(*) FROM accounts")
                row_count = cursor.fetchone()[0]
                
                if row_count > 0:
                    print(f"WARNING: accounts table has {row_count} rows. Data will be lost!")
                    print("If you need this data, cancel the migration and migrate it first.")
                
                # Drop the duplicate table
                cursor.execute("DROP TABLE IF EXISTS accounts")
                print("Successfully dropped duplicate table: accounts")
            else:
                print("Duplicate table 'accounts' does not exist. Nothing to drop.")
                
    except Exception as e:
        print(f"Error dropping duplicate table: {e}")
        # Don't fail the migration if table doesn't exist


def reverse_drop(apps, schema_editor):
    """
    Reverse operation - we cannot recreate the table as we don't know its structure
    """
    print("Cannot reverse dropping of duplicate table. Manual restore required if needed.")
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_rename_chart_of_ac_account_6f8d8e_idx_chart_of_ac_account_af5267_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(drop_duplicate_table, reverse_drop),
    ]
