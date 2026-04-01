# Generated migration for adding payment_gateway field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0117_paymentmethod_default_account'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicefeebilling',
            name='payment_gateway',
            field=models.CharField(
                blank=True,
                help_text='Payment gateway used (e.g., paystation, sslcommerz, manual)',
                max_length=50,
                null=True
            ),
        ),
        migrations.AddIndex(
            model_name='servicefeebilling',
            index=models.Index(fields=['payment_gateway'], name='service_fee_payment_gateway_idx'),
        ),
    ]
