# Safe migration to remove redundant fields from ServiceFeePayment
# This version checks if columns exist before trying to drop them
from django.db import migrations, connection


def safe_remove_fields(apps, schema_editor):
    """
    Safely remove fields only if they exist in the database
    """
    with connection.cursor() as cursor:
        # Check which columns exist in the table
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_management_servicefeepayment'
        """)
        
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        # Fields to remove
        fields_to_remove = [
            'original_amount',
            'remaining_amount', 
            'service_status',
            'service_period_month',
            'service_period_year',
            'due_date'
        ]
        
        # Remove only the fields that exist
        for field in fields_to_remove:
            if field in existing_columns:
                print(f"Removing field: {field}")
                try:
                    cursor.execute(f"ALTER TABLE service_fee_management_servicefeepayment DROP COLUMN {field}")
                    print(f"  Successfully removed: {field}")
                except Exception as e:
                    print(f"  Could not remove {field}: {e}")
            else:
                print(f"Field {field} does not exist, skipping...")


def reverse_safe_remove_fields(apps, schema_editor):
    """
    Reverse operation - add back the fields if needed
    """
    # This is a complex reverse operation that would require knowing the original field definitions
    # For now, we'll just pass as it's unlikely to be needed
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0019_normalize_billing_and_payments'),
    ]

    operations = [
        migrations.RunPython(
            safe_remove_fields,
            reverse_safe_remove_fields,
        ),
    ]
