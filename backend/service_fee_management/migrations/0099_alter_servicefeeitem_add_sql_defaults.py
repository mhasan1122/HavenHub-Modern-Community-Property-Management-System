# Add SQL default values for consumption fields to fix MySQL "No default value" error

from django.db import migrations, models
from django.core.validators import MinValueValidator


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0098_remove_servicefeebillcategory'),
    ]

    operations = [
        # Alter fields to add db_default (SQL-level default)
        migrations.AlterField(
            model_name='servicefeeitem',
            name='price_per_unit',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Price per unit (for bill categories)',
                max_digits=10,
                validators=[MinValueValidator(0)],
                db_default=0,
            ),
        ),
        migrations.AlterField(
            model_name='servicefeeitem',
            name='previous_reading',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Previous meter reading (for bill categories)',
                max_digits=10,
                validators=[MinValueValidator(0)],
                db_default=0,
            ),
        ),
        migrations.AlterField(
            model_name='servicefeeitem',
            name='current_reading',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Current meter reading (for bill categories)',
                max_digits=10,
                validators=[MinValueValidator(0)],
                db_default=0,
            ),
        ),
        migrations.AlterField(
            model_name='servicefeeitem',
            name='consumption',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Consumption amount (for bill categories)',
                max_digits=10,
                validators=[MinValueValidator(0)],
                db_default=0,
            ),
        ),
    ]
