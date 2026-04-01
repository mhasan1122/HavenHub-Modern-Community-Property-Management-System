# Generated migration for UnitStaffHistory model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('towers', '0015_add_ownership_state_fields'),
        ('user', '0001_initial'),  # Adjust if needed based on your user app migrations
    ]

    operations = [
        migrations.CreateModel(
            name='UnitStaffHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_type', models.CharField(choices=[
                    ('staff_assigned', 'Staff Assigned'),
                    ('staff_removed', 'Staff Removed'),
                    ('staff_status_changed', 'Staff Status Changed'),
                ], max_length=50)),
                ('entry_date', models.DateTimeField(help_text='The date/time this staff event occurred')),
                ('description', models.TextField(blank=True, help_text='Human-readable description of the event', null=True)),
                ('staff_status', models.BooleanField(blank=True, help_text='Staff status at the time of event (True=Live-in, False=Part-time)', null=True)),
                ('staff_state_before', models.JSONField(default=list, help_text='Complete staff state before this event with all staff details')),
                ('staff_state_after', models.JSONField(default=list, help_text='Complete staff state after this event with all staff details')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_staff_history', to='user.member')),
                ('staff_member', models.ForeignKey(blank=True, help_text='The staff member involved in this event', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='staff_history_entries', to='user.member')),
                ('unit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='staff_history', to='towers.unit')),
            ],
            options={
                'verbose_name': 'Unit Staff History',
                'verbose_name_plural': 'Unit Staff Histories',
                'ordering': ['-entry_date', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='unitstaffhistory',
            index=models.Index(fields=['unit', '-entry_date'], name='towers_unit_unit_id_staff_idx'),
        ),
        migrations.AddIndex(
            model_name='unitstaffhistory',
            index=models.Index(fields=['entry_type'], name='towers_unit_entry_type_staff_idx'),
        ),
        migrations.AddIndex(
            model_name='unitstaffhistory',
            index=models.Index(fields=['staff_member'], name='towers_unit_staff_member_idx'),
        ),
    ]

