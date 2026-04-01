# Migration to drop old chart_of_accounts tables after app rename
# These tables were created under the old app name and are no longer needed

from django.db import migrations


def drop_old_tables(apps, schema_editor):
    """
    Drop the old chart_of_accounts tables if they exist.
    These are duplicates created before the app was renamed to 'accounts'.
    """
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        with schema_editor.connection.cursor() as cursor:
            # List of old tables to drop
            old_tables = [
                'chart_of_accounts_journalentryline',
                'chart_of_accounts_journalentry',
                'chart_of_accounts_chartofaccount',
            ]
            
            for table_name in old_tables:
                # Check if the table exists
                cursor.execute(f"""
                    SELECT COUNT(*) 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = '{table_name}'
                """)
                
                if cursor.fetchone()[0] > 0:
                    # Check if table has any data before dropping
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    row_count = cursor.fetchone()[0]
                    
                    if row_count > 0:
                        print(f"WARNING: {table_name} table has {row_count} rows. Data will be lost!")
                    
                    # Drop the table
                    cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
                    print(f"Successfully dropped old table: {table_name}")
                else:
                    print(f"Table '{table_name}' does not exist. Skipping.")
                    
    except Exception as e:
        print(f"Error dropping old tables: {e}")
        # Don't fail the migration if tables don't exist


def reverse_drop(apps, schema_editor):
    """
    Reverse operation - we cannot recreate the tables as we don't know their exact structure.
    This migration is one-way only.
    """
    print("Cannot reverse dropping of old tables. Manual restore required if needed.")
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_rename_chart_of_ac_account_af5267_idx_accounts_ac_account_0fe4f1_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(drop_old_tables, reverse_drop),
    ]
