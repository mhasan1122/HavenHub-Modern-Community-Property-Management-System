# Generated manually for late penalty configuration

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee', '0019_delete_servicefeetower'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicefee',
            name='late_payment_enabled',
            field=models.BooleanField(default=False, help_text='Enable late payment penalties'),
        ),
        migrations.CreateModel(
            name='LatePenaltyTier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('days_overdue', models.IntegerField(help_text='Number of days overdue for this penalty tier', validators=[django.core.validators.MinValueValidator(1)])),
                ('penalty_percentage', models.DecimalField(decimal_places=2, help_text='Penalty percentage (0-100)', max_digits=5, validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)])),
                ('order', models.IntegerField(default=0, help_text='Order of this tier (lower numbers = earlier tiers)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('service_fee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='late_penalty_tiers', to='service_fee.servicefee')),
            ],
            options={
                'verbose_name': 'Late Penalty Tier',
                'verbose_name_plural': 'Late Penalty Tiers',
                'ordering': ['order', 'days_overdue'],
                'unique_together': {('service_fee', 'days_overdue')},
            },
        ),
    ]

