# Generated manually to rename table with proper underscore
from django.db import migrations


def rename_table_if_exists(apps, schema_editor):
    """Rename table only if the old table name exists - robust version"""
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        with schema_editor.connection.cursor() as cursor:
            # Check if the old table exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'service_fee_paymentdetails'
            """)
            table_exists = cursor.fetchone()[0] > 0
            
            # Check if the new table already exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'service_fee_payment_details'
            """)
            new_table_exists = cursor.fetchone()[0] > 0
            
            if table_exists and not new_table_exists:
                cursor.execute("ALTER TABLE service_fee_paymentdetails RENAME TO service_fee_payment_details;")
                print("Renamed service_fee_paymentdetails to service_fee_payment_details")
            elif table_exists and new_table_exists:
                print("Both tables exist - skipping rename")
            else:
                print("Table service_fee_paymentdetails does not exist, skipping rename")
    except Exception as e:
        print(f"Error in rename_table_if_exists: {e}")
        # Continue migration even if this fails


def reverse_rename_table_if_exists(apps, schema_editor):
    """Reverse rename only if the new table exists and old doesn't - robust version"""
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        with schema_editor.connection.cursor() as cursor:
            # Check if the new table exists and old doesn't
            cursor.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'service_fee_payment_details') as new_exists,
                    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'service_fee_paymentdetails') as old_exists
            """)
            result = cursor.fetchone()
            new_exists, old_exists = result
            
            if new_exists and not old_exists:
                cursor.execute("ALTER TABLE service_fee_payment_details RENAME TO service_fee_paymentdetails;")
                print("Renamed service_fee_payment_details back to service_fee_paymentdetails")
            else:
                print("Cannot reverse rename - conditions not met")
    except Exception as e:
        print(f"Error in reverse_rename_table_if_exists: {e}")
        # Continue migration even if this fails


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0023_rename_billings_table'),
    ]

    operations = [
        migrations.RunPython(
            rename_table_if_exists,
            reverse_rename_table_if_exists,
        ),
    ]

