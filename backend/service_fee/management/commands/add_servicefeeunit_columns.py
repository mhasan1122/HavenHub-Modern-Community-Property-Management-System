from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Add is_active, created_at, and updated_at columns to service_fee_servicefee_units table'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Check if columns exist
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='service_fee_servicefee_units' 
                AND table_schema=DATABASE()
                AND column_name IN ('is_active', 'created_at', 'updated_at');
            """)
            existing_columns = {row[0] for row in cursor.fetchall()}
            
            self.stdout.write(f"Existing columns: {existing_columns}")
            
            # Add is_active column
            if 'is_active' not in existing_columns:
                self.stdout.write("Adding is_active column...")
                cursor.execute("""
                    ALTER TABLE service_fee_servicefee_units 
                    ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
                """)
                self.stdout.write(self.style.SUCCESS("✓ Added is_active column"))
            else:
                self.stdout.write("is_active column already exists")
            
            # Add created_at column
            if 'created_at' not in existing_columns:
                self.stdout.write("Adding created_at column...")
                cursor.execute("""
                    ALTER TABLE service_fee_servicefee_units 
                    ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
                """)
                self.stdout.write(self.style.SUCCESS("✓ Added created_at column"))
            else:
                self.stdout.write("created_at column already exists")
            
            # Add updated_at column
            if 'updated_at' not in existing_columns:
                self.stdout.write("Adding updated_at column...")
                cursor.execute("""
                    ALTER TABLE service_fee_servicefee_units 
                    ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);
                """)
                self.stdout.write(self.style.SUCCESS("✓ Added updated_at column"))
            else:
                self.stdout.write("updated_at column already exists")
            
            self.stdout.write(self.style.SUCCESS("\n✅ All columns added successfully!"))
