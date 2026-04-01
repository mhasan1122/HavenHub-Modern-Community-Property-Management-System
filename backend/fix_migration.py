#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from django.db.migrations.executor import MigrationExecutor

# Get the migration executor
executor = MigrationExecutor(connection)

# Get applied migrations for service_fee_management
applied = executor.applied_migrations()
print("=== Applied Migrations for service_fee_management ===\n")

service_fee_migs = [m for m in applied if m[0] == 'service_fee_management']
for app, mig in sorted(service_fee_migs):
    print(f"  {app}: {mig}")

# Check if 0096 is applied
mig_0096 = ('service_fee_management', '0096_servicefeegenerationconfig_and_more')
if mig_0096 in applied:
    print(f"\n✓ Migration 0096 is marked as APPLIED")
    print("\nHowever, the column is missing in the database.")
    print("This likely means the migration file has an error or wasn't fully executed.\n")
    
    # Let's check if we need to manually unapply and reapply
    print("Attempting to unapply and reapply migration 0096...\n")
    
    # Unapply migration
    try:
        executor.unapply_migrations(executor.loader.graph.forwards_plan([mig_0096]))
        print("✓ Migration 0096 unapplied")
    except Exception as e:
        print(f"✗ Error unapplying: {e}")
    
    # Now reapply
    try:
        executor.apply_migrations(executor.loader.graph.forwards_plan([mig_0096]))
        print("✓ Migration 0096 reapplied")
    except Exception as e:
        print(f"✗ Error reapplying: {e}")
else:
    print(f"\n✗ Migration 0096 is NOT applied")
    print("Running migration...\n")
    try:
        executor.apply_migrations(executor.loader.graph.forwards_plan([mig_0096]))
        print("✓ Migration 0096 applied")
    except Exception as e:
        print(f"✗ Error applying: {e}")
