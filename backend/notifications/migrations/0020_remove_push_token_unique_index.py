# Generated migration to remove unique constraint on push_token if it exists
from django.db import migrations


def remove_push_token_unique_constraint(apps, schema_editor):
    """
    Safely remove the unique constraint on push_token if it exists.
    In Django migrations, AlterField sometimes doesn't drop the physical unique index 
    on some DB backends if not explicitly handled.
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if a unique constraint/index exists for push_token
        # This query is targeted at MySQL/MariaDB based on the project structure
        cursor.execute("""
            SELECT INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'notifications_devicetoken'
            AND COLUMN_NAME = 'push_token'
            AND NON_UNIQUE = 0
        """)
        indices = cursor.fetchall()
        
        for index in indices:
            index_name = index[0]
            # Skip primary keys
            if index_name == 'PRIMARY':
                continue
                
            print(f"  ✅ Removing unique index on push_token: {index_name}")
            try:
                cursor.execute(f"ALTER TABLE notifications_devicetoken DROP INDEX `{index_name}`")
            except Exception as e:
                print(f"  ⚠️ Failed to drop index {index_name}: {e}")


def reverse_remove_constraint(apps, schema_editor):
    """
    Reverse migration: we don't necessarily want to re-add it as unique
    since the new logic supports multi-user tokens.
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0019_announcement_notifications_channel_both'),
    ]

    operations = [
        migrations.RunPython(remove_push_token_unique_constraint, reverse_remove_constraint),
    ]
