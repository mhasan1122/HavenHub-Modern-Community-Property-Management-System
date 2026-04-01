# Fix payment_method column to allow NULL values in database

from django.db import migrations


def fix_payment_method_column(apps, schema_editor):
    """
    Manually alter the payment_method column to allow NULL values.
    This fixes the database constraint that doesn't match the model definition.
    """
    if schema_editor.connection.vendor == 'mysql':
        with schema_editor.connection.cursor() as cursor:
            # First, check if the column exists and get its current definition
            cursor.execute("""
                SELECT COLUMN_TYPE, IS_NULLABLE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'service_fee_management_servicefeepayment' 
                AND COLUMN_NAME = 'payment_method_id'
            """)
            result = cursor.fetchone()
            
            if result:
                # Alter the column to allow NULL values
                cursor.execute("""
                    ALTER TABLE service_fee_management_servicefeepayment 
                    MODIFY COLUMN payment_method_id BIGINT NULL
                """)
                print("Successfully modified payment_method_id column to allow NULL values")
            else:
                print("payment_method_id column not found, skipping")


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0007_paymentmethod_and_migrate_data'),
    ]

    operations = [
        migrations.RunPython(fix_payment_method_column, reverse_code=migrations.RunPython.noop),
    ]

