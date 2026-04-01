# Generated migration for removing ServiceFeeBillCategory model

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0097_add_consumption_details_to_servicefeeitem'),
    ]

    operations = [
        migrations.DeleteModel(
            name='ServiceFeeBillCategory',
        ),
    ]
