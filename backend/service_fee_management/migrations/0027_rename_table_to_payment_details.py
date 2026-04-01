# Generated migration to rename service_fee_billings to service_fee_payment_details
from django.db import migrations


def rename_table_if_exists(apps, schema_editor):
    """Rename table from service_fee_billings to service_fee_payment_details if it exists"""
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        with schema_editor.connection.cursor() as cursor:
            # Check if the old table exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'service_fee_billings'
            """)
            old_table_exists = cursor.fetchone()[0] > 0
            
            # Check if the new table already exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'service_fee_payment_details'
            """)
            new_table_exists = cursor.fetchone()[0] > 0
            
            if old_table_exists and not new_table_exists:
                cursor.execute("ALTER TABLE service_fee_billings RENAME TO service_fee_payment_details;")
                print("Successfully renamed service_fee_billings to service_fee_payment_details")
            elif old_table_exists and new_table_exists:
                print("Both tables exist - skipping rename")
            else:
                print("Table service_fee_billings does not exist - skipping rename")
    except Exception as e:
        print(f"Error in rename_table_if_exists: {e}")
        # Continue migration even if this fails


def reverse_rename_table_if_exists(apps, schema_editor):
    """Reverse rename from service_fee_payment_details to service_fee_billings if it exists"""
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        with schema_editor.connection.cursor() as cursor:
            # Check if the new table exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'service_fee_payment_details'
            """)
            new_table_exists = cursor.fetchone()[0] > 0
            
            # Check if the old table already exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'service_fee_billings'
            """)
            old_table_exists = cursor.fetchone()[0] > 0
            
            if new_table_exists and not old_table_exists:
                cursor.execute("ALTER TABLE service_fee_payment_details RENAME TO service_fee_billings;")
                print("Successfully renamed service_fee_payment_details back to service_fee_billings")
            else:
                print("Cannot reverse rename - conditions not met")
    except Exception as e:
        print(f"Error in reverse_rename_table_if_exists: {e}")
        # Continue migration even if this fails


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0026_remove_servicefeebilling_unique_billing_per_month_and_more'),
    ]

    operations = [
        migrations.RunPython(
            rename_table_if_exists,
            reverse_rename_table_if_exists,
        ),
    ]
