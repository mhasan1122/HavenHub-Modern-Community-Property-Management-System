# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('towers', '0021_unitstaffhistory_staff_member_contact_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='owner',
            name='last_transfer_date',
            field=models.DateField(blank=True, help_text='Date of the last ownership transfer or percentage change', null=True),
        ),
    ]
