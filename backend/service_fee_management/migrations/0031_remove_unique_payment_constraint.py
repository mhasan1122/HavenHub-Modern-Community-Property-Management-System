# Generated migration to remove unique constraint on payments
# This allows multiple partial payments for the same unit/month/year

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0030_merge_20251029_1659'),
    ]

    operations = [
        # Remove the unique constraint from ServiceFeePayment model
        migrations.AlterUniqueTogether(
            name='servicefeepayment',
            unique_together=set(),  # Remove all unique_together constraints
        ),
    ]

