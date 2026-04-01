# Generated manually to rename table
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0022_populate_payment_result_status'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='servicefeebilling',
            table='service_fee_payment_details',
        ),
    ]

