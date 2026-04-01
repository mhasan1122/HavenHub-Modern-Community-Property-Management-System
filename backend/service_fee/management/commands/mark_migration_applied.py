from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Manually mark migration 0016_servicefeeunit as applied'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Check if migration is already applied
            cursor.execute("""
                SELECT id FROM django_migrations 
                WHERE app='service_fee' AND name='0016_servicefeeunit';
            """)
            if cursor.fetchone():
                self.stdout.write(self.style.WARNING("Migration 0016_servicefeeunit is already applied"))
                return
            
            # Insert migration record
            cursor.execute("""
                INSERT INTO django_migrations (app, name, applied) 
                VALUES ('service_fee', '0016_servicefeeunit', NOW());
            """)
            
            self.stdout.write(self.style.SUCCESS("✅ Migration 0016_servicefeeunit marked as applied"))
