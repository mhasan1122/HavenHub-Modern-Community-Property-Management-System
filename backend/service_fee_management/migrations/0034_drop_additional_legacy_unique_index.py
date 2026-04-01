from django.db import migrations


def drop_additional_legacy_unique_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != 'mysql':
        return
    
    try:
        from django.db import connection

        table_names = [
            'service_fee_management_servicefeepayment',
            'service_fee_payments',
        ]

        candidate_sets = [
            {'unit_id', 'service_period_month', 'service_period_year', 'service_fee_id'},
            {'unit_id', 'service_period_month', 'service_fee_id'},  # observed in production
        ]

        with connection.cursor() as cursor:
            # Detect actual table
            actual_table = None
            for name in table_names:
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s
                    """,
                    [name],
                )
                if cursor.fetchone()[0]:
                    actual_table = name
                    break

            if not actual_table:
                print("Table not found, skipping additional legacy index drop")
                return

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

            for index_name, cols in list(index_to_columns.items()):
                ordered_cols = [col for _, col in sorted(cols)]
                colset = set(ordered_cols)
                for target in candidate_sets:
                    if colset == target and len(ordered_cols) == len(target):
                        # Ensure FKs have supporting indexes before dropping composite unique index
                        try:
                            cursor.execute(f"CREATE INDEX idx_{actual_table}_unit_id ON `{actual_table}` (unit_id)")
                            print(f"Created supporting index for {actual_table}")
                        except Exception as e:
                            print(f"Index may already exist or error creating: {e}")

                        # Now drop the unique index
                        try:
                            cursor.execute(f"DROP INDEX `{index_name}` ON `{actual_table}`")
                            print(f"Dropped additional legacy unique index: {index_name} from {actual_table}")
                        except Exception as e:
                            print(f"Could not drop index {index_name}: {e}")
                        break
    except Exception as e:
        print(f"Error in drop_additional_legacy_unique_indexes: {e}")
        # Continue migration even if this fails


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('service_fee_management', '0033_drop_legacy_unique_index'),
    ]

    operations = [
        migrations.RunPython(drop_additional_legacy_unique_indexes, noop_reverse),
    ]


