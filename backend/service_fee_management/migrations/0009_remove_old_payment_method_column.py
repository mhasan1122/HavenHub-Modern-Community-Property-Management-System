# Remove old payment_method varchar column and keep only payment_method_id FK

from django.db import migrations


def remove_old_payment_method_column(apps, schema_editor):
    """
    Remove the old payment_method varchar column that's causing conflicts.
    We now use payment_method_id (Foreign Key) instead.
    """
    if schema_editor.connection.vendor == 'mysql':
        with schema_editor.connection.cursor() as cursor:
            # Check if the old varchar column still exists
            cursor.execute("""
                SELECT COLUMN_NAME, COLUMN_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'service_fee_management_servicefeepayment' 
                AND COLUMN_NAME = 'payment_method'
            """)
            result = cursor.fetchone()
            
            if result and 'varchar' in result[1].lower():
                # Drop the old varchar column
                cursor.execute("""
                    ALTER TABLE service_fee_management_servicefeepayment 
                    DROP COLUMN payment_method
                """)
                print("Successfully removed old payment_method varchar column")
            else:
                print("Old payment_method column not found or already removed")


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0008_fix_payment_method_column'),
    ]

    operations = [
        migrations.RunPython(remove_old_payment_method_column, reverse_code=migrations.RunPython.noop),
    ]

