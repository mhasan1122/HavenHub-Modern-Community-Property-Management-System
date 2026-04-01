# Generated migration to add missing fields to service_fee_servicefee_units table

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee', '0016_servicefeeunit'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                # Add is_active column
                """
                ALTER TABLE service_fee_servicefee_units
                ADD COLUMN is_active TINYINT(1) DEFAULT 1 NOT NULL;
                """,
            ],
            reverse_sql=[
                "ALTER TABLE service_fee_servicefee_units DROP COLUMN is_active;",
            ],
            state_operations=[
                # This is handled by the model definition in migration 0016
            ]
        ),
        migrations.RunSQL(
            sql=[
                # Add created_at column
                """
                ALTER TABLE service_fee_servicefee_units
                ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
                """,
            ],
            reverse_sql=[
                "ALTER TABLE service_fee_servicefee_units DROP COLUMN created_at;",
            ]
        ),
        migrations.RunSQL(
            sql=[
                # Add updated_at column
                """
                ALTER TABLE service_fee_servicefee_units
                ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
                """,
            ],
            reverse_sql=[
                "ALTER TABLE service_fee_servicefee_units DROP COLUMN updated_at;",
            ]
        ),
    ]
