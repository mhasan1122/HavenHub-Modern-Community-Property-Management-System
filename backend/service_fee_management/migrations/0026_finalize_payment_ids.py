# Migration to make receipt_id and transaction_id non-nullable
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0025_auto_20251029_1346'),
    ]

    operations = [
        # Make receipt_id non-nullable
        migrations.AlterField(
            model_name='servicefeepayment',
            name='receipt_id',
            field=models.CharField(help_text='Unique receipt identifier (e.g., RCP-2024-01-00001)', max_length=100, unique=True),
        ),
        # Make transaction_id non-nullable
        migrations.AlterField(
            model_name='servicefeepayment',
            name='transaction_id',
            field=models.CharField(help_text='Unique transaction identifier', max_length=100, unique=True),
        ),
    ]
