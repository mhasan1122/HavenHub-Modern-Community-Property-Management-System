# Migration to remove redundant fields from ServiceFeePayment
# These fields now exist only in ServiceFeeBilling
# Note: This migration is a no-op because fields were already removed by 0020_remove_redundant_fields_safe
from django.db import migrations


def noop(apps, schema_editor):
    """No operation - fields already removed by earlier migration"""
    print("Fields already removed by 0020_remove_redundant_fields_safe, skipping...")


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0019_normalize_billing_and_payments'),
    ]

    operations = [
        # This migration is essentially a no-op
        # All operations were already performed by 0020_remove_redundant_fields_safe
        migrations.RunPython(noop, lambda apps, schema_editor: None),
    ]

