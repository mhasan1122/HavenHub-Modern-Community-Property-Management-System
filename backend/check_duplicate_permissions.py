#!/usr/bin/env python
"""
Script to check for duplicate permissions in the database
and identify which permissions have the same name but different IDs
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from group_role.models import Permission
from django.db.models import Count

print("=" * 80)
print("CHECKING FOR DUPLICATE PERMISSIONS")
print("=" * 80)

# Find permissions with duplicate names
duplicates = (
    Permission.objects
    .values('permission_name')
    .annotate(count=Count('id'))
    .filter(count__gt=1)
    .order_by('permission_name')
)

if not duplicates:
    print("\n✅ No duplicate permissions found!")
else:
    print(f"\n❌ Found {len(duplicates)} permission names with duplicates:\n")
    
    for dup in duplicates:
        perm_name = dup['permission_name']
        count = dup['count']
        
        print(f"\n📌 '{perm_name}' appears {count} times:")
        print("-" * 60)
        
        perms = Permission.objects.filter(permission_name=perm_name).order_by('id')
        for perm in perms:
            # Check how many roles use this permission
            role_count = perm.permission_roles.count()
            print(f"   ID: {perm.id:3d} | Used by {role_count} role(s)")

print("\n" + "=" * 80)
print("BILL CATEGORIES PERMISSIONS CHECK")
print("=" * 80)

bill_cat_permissions = [
    "View Bill Categories",
    "Add Bill Categories", 
    "Edit Bill Categories",
]

for perm_name in bill_cat_permissions:
    perms = Permission.objects.filter(permission_name=perm_name)
    print(f"\n'{perm_name}':")
    if not perms.exists():
        print("   ❌ NOT FOUND in database")
    else:
        for perm in perms:
            role_count = perm.permission_roles.count()
            print(f"   ID: {perm.id:3d} | Used by {role_count} role(s)")

print("\n" + "=" * 80)
print("ALL PERMISSIONS (IDs 60-65)")
print("=" * 80)

perms_60_to_65 = Permission.objects.filter(id__gte=60, id__lte=65).order_by('id')
for perm in perms_60_to_65:
    role_count = perm.permission_roles.count()
    print(f"ID: {perm.id:3d} | {perm.permission_name:40s} | {role_count} role(s)")

print("\n" + "=" * 80)
