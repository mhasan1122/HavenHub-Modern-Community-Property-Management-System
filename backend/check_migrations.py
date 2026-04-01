#!/usr/bin/env python
"""Check migration status"""
import os
import django
from django.core.management import execute_from_command_line

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# Show migrations
print("=" * 80)
print("SERVICE FEE MANAGEMENT MIGRATIONS STATUS")
print("=" * 80)

execute_from_command_line(['manage.py', 'showmigrations', 'service_fee_management', '--verbosity', '2'])
