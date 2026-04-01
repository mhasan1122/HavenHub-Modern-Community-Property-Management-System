# Generated migration for ReminderLog timing tracking fields

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0065_remove_send_when_type_day'),
    ]

    operations = [
        migrations.AddField(
            model_name='reminderlog',
            name='timing_rule_id',
            field=models.IntegerField(
                blank=True,
                help_text='Timing rule id that triggered this send',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='reminderlog',
            name='send_time',
            field=models.CharField(
                blank=True,
                help_text='Time when reminder was sent (HH:MM format)',
                max_length=10,
                null=True
            ),
        ),
        migrations.AddIndex(
            model_name='reminderlog',
            index=models.Index(
                fields=['reminder', 'timing_rule_id', 'send_time', 'sent_at'],
                name='service_fee_reminder_timing_idx'
            ),
        ),
    ]
