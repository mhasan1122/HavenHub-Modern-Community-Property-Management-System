# Generated migration for UnitOwnershipHistory model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('towers', '0011_alter_owner_unique_together_delete_vehicle'),
    ]

    operations = [
        migrations.CreateModel(
            name='UnitOwnershipHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_type', models.CharField(choices=[
                    ('initial_ownership', 'Initial Ownership'),
                    ('initial_ownership_list', 'Initial Ownership List'),
                    ('ownership_transfer', 'Ownership Transfer'),
                    ('ownership_updated', 'Ownership Updated'),
                    ('ownership_list_updated', 'Ownership List Updated'),
                ], max_length=50)),
                ('entry_date', models.DateTimeField(help_text='The date/time this ownership event occurred')),
                ('description', models.TextField(blank=True, help_text='Human-readable description of the event (not used, kept for compatibility)', null=True)),
                ('ownership_state_before', models.JSONField(default=list, help_text='Complete ownership state before this event with all owner details')),
                ('ownership_state_after', models.JSONField(default=list, help_text='Complete ownership state after this event with all owner details')),
                ('transfer_from', models.JSONField(blank=True, help_text='DEPRECATED: Use ownership_state_before/after. Array of owners transferring out', null=True)),
                ('transfer_to', models.JSONField(blank=True, help_text='DEPRECATED: Use ownership_state_before/after. Array of owners receiving transfer', null=True)),
                ('owners', models.JSONField(default=list, help_text='DEPRECATED: Use ownership_state_after. Array of owner objects with full details')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_ownership_history', to='user.member')),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ownership_history', to='towers.unit')),
            ],
            options={
                'verbose_name': 'Unit Ownership History',
                'verbose_name_plural': 'Unit Ownership Histories',
                'ordering': ['-entry_date', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='unitownershiphistory',
            index=models.Index(fields=['unit', '-entry_date'], name='towers_unit_unit_id_f0a7e3_idx'),
        ),
        migrations.AddIndex(
            model_name='unitownershiphistory',
            index=models.Index(fields=['entry_type'], name='towers_unit_entry_t_8f9a2c_idx'),
        ),
    ]

