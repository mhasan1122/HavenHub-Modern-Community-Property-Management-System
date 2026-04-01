# Generated migration to allow multiple MFS accounts per provider
# This changes the unique constraint to allow multiple accounts per provider
# but prevents duplicate account numbers within the same provider and service fee

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee', '0012_remove_mfs_account_number_unique_constraint'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='servicefeemfs',
            unique_together={('service_fee', 'provider', 'account_number')},
        ),
    ]
