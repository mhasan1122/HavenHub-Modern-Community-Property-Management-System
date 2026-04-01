# Generated migration for adding voucher and payment account fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0082_servicefeepayment_additional_bill_charges_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicefeebilling',
            name='voucher_id',
            field=models.IntegerField(blank=True, null=True, help_text='Link to bill voucher (VoucherEntry ID)'),
        ),
        migrations.AddField(
            model_name='servicefeebilling',
            name='payment_account_code',
            field=models.CharField(blank=True, max_length=20, null=True, help_text='Account code for payment method (e.g., 1110 for Cash)'),
        ),
        migrations.AddField(
            model_name='servicefeebilling',
            name='payment_account_name',
            field=models.CharField(blank=True, max_length=255, null=True, help_text='Account name for payment method (e.g., Cash Account)'),
        ),
    ]
