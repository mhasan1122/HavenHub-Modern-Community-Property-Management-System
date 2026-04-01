# Generated migration to remove unique constraint on DeviceToken
from django.db import migrations


def remove_unique_constraint(apps, schema_editor):
    """
    Safely remove the unique constraint on (member, push_token) if it exists
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if the unique constraint exists
        cursor.execute("""
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'notifications_devicetoken'
            AND CONSTRAINT_TYPE = 'UNIQUE'
            AND CONSTRAINT_NAME LIKE '%member%token%'
        """)
        constraints = cursor.fetchall()
        
        for constraint in constraints:
            constraint_name = constraint[0]
            print(f"  ✅ Removing unique constraint: {constraint_name}")
            cursor.execute(f"""
                ALTER TABLE notifications_devicetoken 
                DROP INDEX `{constraint_name}`
            """)


def reverse_remove_constraint(apps, schema_editor):
    """
    Reverse migration: re-add the unique constraint
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if constraint already exists
        cursor.execute("""
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'notifications_devicetoken'
            AND CONSTRAINT_TYPE = 'UNIQUE'
            AND CONSTRAINT_NAME LIKE '%member%token%'
        """)
        if not cursor.fetchall():
            print("  ✅ Re-adding unique constraint on (member_id, push_token)")
            cursor.execute("""
                ALTER TABLE notifications_devicetoken 
                ADD UNIQUE KEY `notifications_devicetoken_member_id_token_b9f6daf7_uniq` 
                (`member_id`, `push_token`)
            """)


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0015_rename_token_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(remove_unique_constraint, reverse_remove_constraint),
            ],
            state_operations=[
                migrations.AlterUniqueTogether(
                    name='devicetoken',
                    unique_together=set(),
                ),
            ]
        ),
    ]

