# Generated migration to fix MFS account number unique constraint issue
# This removes the ('provider', 'account_number') unique constraint that prevents
# the same mobile number from being used across different MFS providers

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee', '0011_alter_servicefee_fee_amount'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='servicefeemfs',
            unique_together={('service_fee', 'provider')},
        ),
    ]
