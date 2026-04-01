# Generated migration for adding send_times JSON field

from django.db import migrations, models


def safe_add_send_times(apps, schema_editor):
    """Safely add send_times column if it doesn't exist."""
    connection = schema_editor.connection
    
    with connection.cursor() as cursor:
        # Check if send_times column exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_reminder_timings'
            AND COLUMN_NAME = 'send_times'
        """)
        column_exists = cursor.fetchone()[0] > 0
        
        if not column_exists:
            # Add the column
            cursor.execute("""
                ALTER TABLE service_fee_reminder_timings 
                ADD COLUMN `send_times` JSON DEFAULT (JSON_ARRAY()) 
                COMMENT "List of times to send reminder (e.g., ['10:00:00', '14:00:00'])"
            """)
            
            # Check if send_time column exists before migrating data
            cursor.execute("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'service_fee_reminder_timings'
                AND COLUMN_NAME = 'send_time'
            """)
            send_time_exists = cursor.fetchone()[0] > 0
            
            if send_time_exists:
                # Migrate data from send_time to send_times (only if send_time exists)
                cursor.execute("""
                    UPDATE service_fee_reminder_timings 
                    SET `send_times` = JSON_ARRAY(TIME_FORMAT(`send_time`, '%%H:%%i:%%s'))
                    WHERE `send_time` IS NOT NULL
                """)
        
        # Make send_time nullable if it exists and isn't already nullable
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_reminder_timings'
            AND COLUMN_NAME = 'send_time'
        """)
        send_time_exists = cursor.fetchone()[0] > 0
        
        if send_time_exists:
            cursor.execute("""
                SELECT IS_NULLABLE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'service_fee_reminder_timings'
                AND COLUMN_NAME = 'send_time'
            """)
            result = cursor.fetchone()
            if result and result[0] == 'NO':
                cursor.execute("""
                    ALTER TABLE service_fee_reminder_timings 
                    MODIFY COLUMN `send_time` TIME NULL 
                    COMMENT "DEPRECATED: Use send_times instead"
                """)





def reverse_send_times(apps, schema_editor):
    """Reverse the migration."""
    connection = schema_editor.connection
    
    with connection.cursor() as cursor:
        # Copy first send_times element back to send_time
        cursor.execute("""
            UPDATE service_fee_reminder_timings 
            SET send_time = JSON_UNQUOTE(JSON_EXTRACT(send_times, '$[0]'))
            WHERE send_times IS NOT NULL AND JSON_LENGTH(send_times) > 0
        """)
        
        # Drop send_times column
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'service_fee_reminder_timings'
            AND COLUMN_NAME = 'send_times'
        """)
        if cursor.fetchone()[0] > 0:
            cursor.execute("ALTER TABLE service_fee_reminder_timings DROP COLUMN send_times")


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0059_migrate_json_to_tables'),
    ]

    operations = [
        migrations.RunPython(
            code=safe_add_send_times,
            reverse_code=reverse_send_times,
        ),
    ]
