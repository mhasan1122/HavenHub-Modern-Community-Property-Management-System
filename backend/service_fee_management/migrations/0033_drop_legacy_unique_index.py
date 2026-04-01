from django.db import migrations


def drop_legacy_unique_index(apps, schema_editor):
    """
    Drop any lingering MySQL unique indexes on service_fee_management_servicefeepayment
    that enforce uniqueness on (unit_id, service_period_month, service_period_year, service_fee_id).
    """
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        from django.db import connection

        table_names = [
            'service_fee_management_servicefeepayment',
            'service_fee_payments',  # fallback if table got renamed in older DBs
        ]

        target_columns = {'unit_id', 'service_period_month', 'service_period_year', 'service_fee_id'}

        with connection.cursor() as cursor:
            # Detect which table actually exists
            actual_table = None
            for name in table_names:
                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = %s
                    """,
                    [name],
                )
                if cursor.fetchone()[0]:
                    actual_table = name
                    break

            if not actual_table:
                print("Table not found, skipping legacy index drop")
                return  # Table not present; nothing to do

            # Find unique indexes on this table
            cursor.execute(
                """
                SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = %s
                  AND NON_UNIQUE = 0
                ORDER BY INDEX_NAME, SEQ_IN_INDEX
                """,
                [actual_table],
            )

            index_to_columns = {}
            for index_name, column_name, seq in cursor.fetchall():
                index_to_columns.setdefault(index_name, []).append((seq, column_name))

            # Normalize to ordered lists of column names
            for index_name in list(index_to_columns.keys()):
                cols = [col for _, col in sorted(index_to_columns[index_name])]
                index_to_columns[index_name] = cols

            # Identify any unique index that is exactly the target set (order-insensitive)
            for index_name, cols in index_to_columns.items():
                if set(cols) == target_columns and len(cols) == 4:
                    # Drop the unique index
                    try:
                        cursor.execute(f"DROP INDEX `{index_name}` ON `{actual_table}`")
                        print(f"Dropped legacy unique index: {index_name} from {actual_table}")
                    except Exception as e:
                        print(f"Could not drop index {index_name}: {e}")
    except Exception as e:
        print(f"Error in drop_legacy_unique_index: {e}")
        # Continue migration even if this fails


def noop_reverse(apps, schema_editor):
    # No-op: we do not recreate the legacy unique index
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0032_servicefeepayment_service_period_month'),
    ]

    operations = [
        migrations.RunPython(drop_legacy_unique_index, noop_reverse),
    ]


