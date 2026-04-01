from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("user", "0003_member_terms_accepted_member_terms_accepted_at_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS django_cache (
                    cache_key VARCHAR(255) NOT NULL PRIMARY KEY,
                    value LONGTEXT NOT NULL,
                    expires DATETIME NOT NULL
                );
                CREATE INDEX django_cache_expires ON django_cache (expires);
            """,
            reverse_sql="""
                DROP TABLE IF EXISTS django_cache;
            """,
        ),
    ]

