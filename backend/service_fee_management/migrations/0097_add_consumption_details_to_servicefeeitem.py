# Generated migration for adding consumption details to ServiceFeeItem

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0096_servicefeegenerationconfig_and_more'),
    ]

    operations = [
        # Add consumption detail fields to ServiceFeeItem
        migrations.AddField(
            model_name='servicefeeitem',
            name='unit_of_measurement',
            field=models.CharField(
                blank=True,
                help_text='e.g., kWh, cubic meters (for bill categories)',
                max_length=20,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='servicefeeitem',
            name='price_per_unit',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Price per unit (for bill categories)',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
        migrations.AddField(
            model_name='servicefeeitem',
            name='previous_reading',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Previous meter reading (for bill categories)',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
        migrations.AddField(
            model_name='servicefeeitem',
            name='current_reading',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Current meter reading (for bill categories)',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
        migrations.AddField(
            model_name='servicefeeitem',
            name='consumption',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Consumption amount (for bill categories)',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
    ]
