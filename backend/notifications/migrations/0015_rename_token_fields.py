# Generated migration to handle old database schema
from django.db import migrations


def rename_columns_if_exist(apps, schema_editor):
    """
    Safely rename old column names to new ones if they exist
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if old columns exist
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'notifications_devicetoken'
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        # Rename 'token' to 'push_token' if old column exists
        if 'token' in existing_columns and 'push_token' not in existing_columns:
            print("  ✅ Renaming 'token' → 'push_token'")
            cursor.execute("""
                ALTER TABLE notifications_devicetoken 
                CHANGE COLUMN `token` `push_token` VARCHAR(255) NOT NULL
            """)
        elif 'push_token' in existing_columns:
            print("  ℹ️  Column 'push_token' already exists, skipping rename")
        
        # Rename 'platform' to 'device_type' if old column exists
        if 'platform' in existing_columns and 'device_type' not in existing_columns:
            print("  ✅ Renaming 'platform' → 'device_type'")
            cursor.execute("""
                ALTER TABLE notifications_devicetoken 
                CHANGE COLUMN `platform` `device_type` VARCHAR(20) NOT NULL
            """)
        elif 'device_type' in existing_columns:
            print("  ℹ️  Column 'device_type' already exists, skipping rename")


def reverse_rename_columns(apps, schema_editor):
    """
    Reverse migration: rename new columns back to old names
    """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'notifications_devicetoken'
        """)
        existing_columns = {row[0] for row in cursor.fetchall()}
        
        if 'push_token' in existing_columns:
            cursor.execute("""
                ALTER TABLE notifications_devicetoken 
                CHANGE COLUMN `push_token` `token` VARCHAR(255) NOT NULL
            """)
        
        if 'device_type' in existing_columns:
            cursor.execute("""
                ALTER TABLE notifications_devicetoken 
                CHANGE COLUMN `device_type` `platform` VARCHAR(20) NOT NULL
            """)


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0014_remove_notification_notificatio_priorit_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(rename_columns_if_exist, reverse_rename_columns),
    ]
