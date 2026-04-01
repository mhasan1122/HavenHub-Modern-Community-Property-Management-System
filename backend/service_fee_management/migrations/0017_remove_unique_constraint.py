# Generated manually to remove unique_together constraint
# This allows multiple partial payments for the same unit/month/year
# Fixed version that handles the duplicate key issue

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0012_merge_20251019_1110'),  # Latest migration
    ]

    operations = [
        migrations.RunSQL(
            # Remove the unique constraint directly from the database - robust version
            """
            SET @index_exists = (
                SELECT COUNT(*) 
                FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'service_fee_management_servicefeepayment' 
                AND index_name = 'service_fee_management_servicefeepayment_unit_id_service_period_month_service_period_year_service_fee_id_uniq'
            );
            SET @sql = IF(@index_exists > 0, 
                'ALTER TABLE service_fee_management_servicefeepayment DROP INDEX service_fee_management_servicefeepayment_unit_id_service_period_month_service_period_year_service_fee_id_uniq', 
                'SELECT "Index does not exist" as message'
            );
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            """,
            reverse_sql="-- No reverse operation needed",
            # Only run on MySQL
            state_operations=[],
        ),
    ]
