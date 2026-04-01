from django.db import migrations, models


def safe_add_reminder_send_times(apps, schema_editor):
    """Safely add send_times to Reminder and copy data."""
    connection = schema_editor.connection
    Reminder = apps.get_model('service_fee_management', 'Reminder')
    ReminderTiming = apps.get_model('service_fee_management', 'ReminderTiming')
    
    with connection.cursor() as cursor:
        # Check if send_times column exists in reminder table
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_reminders'
            AND COLUMN_NAME = 'send_times'
        """)
        column_exists = cursor.fetchone()[0] > 0
        
        if not column_exists:
            # Add the column to Reminder
            cursor.execute("""
                ALTER TABLE service_fee_reminders 
                ADD COLUMN `send_times` JSON DEFAULT (JSON_ARRAY()) 
                COMMENT "List of times to send reminder (e.g., ['10:00:00', '14:00:00'])"
            """)

    
    # Copy data from ReminderTiming to Reminder
    for reminder in Reminder.objects.all():
        # Collect unique times from timing rules
        times_set = set()
        timings = ReminderTiming.objects.filter(reminder=reminder)
        for timing in timings:
            send_times = timing.send_times or [] if hasattr(timing, 'send_times') else []
            for t in send_times:
                if t:
                    times_set.add(str(t))
        # If reminder already has send_times, merge
        existing = reminder.send_times or [] if hasattr(reminder, 'send_times') else []
        for t in existing:
            if t:
                times_set.add(str(t))
        reminder.send_times = list(times_set)
        reminder.save(update_fields=['send_times'])


def safe_remove_timing_columns(apps, schema_editor):
    """Safely remove send_time and send_times from ReminderTiming."""
    connection = schema_editor.connection
    
    with connection.cursor() as cursor:
        # Check and remove send_time column
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_reminder_timings'
            AND COLUMN_NAME = 'send_time'
        """)
        if cursor.fetchone()[0] > 0:
            cursor.execute("ALTER TABLE service_fee_reminder_timings DROP COLUMN `send_time`")
        
        # Check and remove send_times column
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_reminder_timings'
            AND COLUMN_NAME = 'send_times'
        """)
        if cursor.fetchone()[0] > 0:
            cursor.execute("ALTER TABLE service_fee_reminder_timings DROP COLUMN `send_times`")


def reverse_migration(apps, schema_editor):
    """No-op reverse to avoid re-creating dropped columns."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0060_add_send_times_json'),
    ]

    operations = [
        migrations.RunPython(
            code=safe_add_reminder_send_times,
            reverse_code=reverse_migration,
        ),
        migrations.RunPython(
            code=safe_remove_timing_columns,
            reverse_code=reverse_migration,
        ),
    ]
