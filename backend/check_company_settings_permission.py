#!/usr/bin/env python
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from group_role.models import Permission

print("=" * 80)
print("CHECKING SPECIFIC PERMISSIONS")
print("=" * 80)

# Check specific permission names
permission_names = [
    "Expire Notices",
    "View Company Settings",
    "View Bill Categories",
    "Add Bill Categories",
    "Edit Bill Categories",
]

for name in permission_names:
    perms = Permission.objects.filter(permission_name=name)
    if perms.exists():
        for perm in perms:
            print(f"'{name}': ID {perm.id}")
    else:
        print(f"'{name}': NOT FOUND")

print("\n" + "=" * 80)
print("ALL PERMISSIONS (IDs 55-65)")
print("=" * 80)

for perm in Permission.objects.filter(id__gte=55, id__lte=65).order_by('id'):
    print(f"ID: {perm.id:3d} | {perm.permission_name}")
