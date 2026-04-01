# Generated manually to migrate service_fee_servicefee_towers to use through model

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee', '0017_add_servicefeeunit_fields'),
        ('towers', '0011_alter_owner_unique_together_delete_vehicle'),
    ]

    operations = [
        # Just create the model - the table already exists with the right structure
        migrations.CreateModel(
            name='ServiceFeeTower',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('service_fee', models.ForeignKey(db_column='servicefee_id', on_delete=django.db.models.deletion.CASCADE, to='service_fee.servicefee')),
                ('tower', models.ForeignKey(db_column='tower_id', on_delete=django.db.models.deletion.CASCADE, to='towers.tower')),
            ],
            options={
                'verbose_name': 'Service Fee Tower Assignment',
                'verbose_name_plural': 'Service Fee Tower Assignments',
                'db_table': 'service_fee_servicefee_towers_v2',
                'unique_together': {('service_fee', 'tower')},
            },
        ),
    ]
