# Generated migration to add payment_result_status to ServiceFeeBilling

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0122_paystationtransactionmapping_is_advance_payment'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicefeebilling',
            name='payment_result_status',
            field=models.CharField(
                blank=True,
                choices=[('full', 'Full Payment'), ('partial', 'Partial Payment'), ('overpayment', 'Overpayment')],
                help_text='Result of this payment: whether it was partial, full, or overpayment at the time of transaction',
                max_length=20,
                null=True
            ),
        ),
    ]
