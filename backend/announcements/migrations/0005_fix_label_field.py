# Custom migration to fix label field database schema issue
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('announcements', '0004_alter_announcement_label'),
    ]

    operations = [
        # First, check and drop the problematic label_id column if it exists
        migrations.RunSQL(
            """
            SET @sql = (SELECT IF(
                (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE table_name = 'announcements_announcement'
                 AND column_name = 'label_id'
                 AND table_schema = DATABASE()) > 0,
                'ALTER TABLE announcements_announcement DROP COLUMN label_id',
                'SELECT 1'
            ));
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            """,
            reverse_sql="-- No reverse operation needed"
        ),

        # Ensure the label column exists with correct definition
        migrations.RunSQL(
            """
            ALTER TABLE announcements_announcement
            MODIFY COLUMN label VARCHAR(100) NULL DEFAULT '';
            """,
            reverse_sql="-- No reverse operation needed"
        ),
    ]
