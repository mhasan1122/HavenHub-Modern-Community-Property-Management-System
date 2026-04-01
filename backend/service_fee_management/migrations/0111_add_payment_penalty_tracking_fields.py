# Generated manually on 2026-01-19
# Add payment and penalty tracking fields to ServiceFeePayment

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0110_rename_table_to_generate'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicefeepayment',
            name='total_paid',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Total amount paid towards this bill (from billing records)',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)]
            ),
        ),
        migrations.AddField(
            model_name='servicefeepayment',
            name='penalty_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Current penalty amount (after waivers)',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)]
            ),
        ),
        migrations.AddField(
            model_name='servicefeepayment',
            name='waived_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Total amount waived (penalties and fees)',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)]
            ),
        ),
        migrations.AddField(
            model_name='servicefeepayment',
            name='gross_penalty_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text='Gross penalty amount (before waivers)',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)]
            ),
        ),
    ]
