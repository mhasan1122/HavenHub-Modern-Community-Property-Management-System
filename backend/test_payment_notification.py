import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from notifications.utils import get_members_with_record_payment_permission

recipients = get_members_with_record_payment_permission()
print(f"Recipients found: {len(recipients)}")
for r in recipients:
    print(f"- {r.id}: {r.full_name}")

from group_role.models import RolePermission, GroupRole
print("\nChecking permissions 40, 41, 44 for super admins:")
super_admin_roles = GroupRole.objects.filter(role_title='SuperAdmin')
for role in super_admin_roles:
    perms = RolePermission.objects.filter(role=role, permission_id__in=[40, 41, 44]).values_list('permission_id', flat=True)
    print(f"Role {role.id} ({role.role_title}) has permissions: {list(perms)}")
