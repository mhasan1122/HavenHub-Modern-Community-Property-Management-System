# Generated migration for adding payment_result_status field
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0020_remove_redundant_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicefeepayment',
            name='payment_result_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('partial', 'Partial Payment'),
                    ('full', 'Full Payment'),
                    ('overpayment', 'Overpayment')
                ],
                help_text='Result of this payment: whether it was partial, full, or overpayment at the time of completion',
                max_length=20,
                null=True
            ),
        ),
    ]

