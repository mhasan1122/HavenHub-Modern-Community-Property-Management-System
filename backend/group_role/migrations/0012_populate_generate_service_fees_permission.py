# Generated migration to populate Generate Service Fees permission in GlobalRolePermission

from django.db import migrations
from group_role.permission_constants import (
    PERMISSION_GENERATE_SERVICE_FEES,
    PERMISSION_NAME_BY_ID,
)


def populate_generate_service_fees_permission(apps, schema_editor):
    """Populate Generate Service Fees permission in GlobalRolePermission"""
    Permission = apps.get_model('group_role', 'Permission')
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')
    
    # 1. Ensure permission exists in Permission table
    permission_id = PERMISSION_GENERATE_SERVICE_FEES
    permission_name = PERMISSION_NAME_BY_ID.get(permission_id, "Generate Service Fees")
    
    # We use update_or_create to ensure it exists with the correct name
    permission_obj, created = Permission.objects.update_or_create(
        id=permission_id,
        defaults={'permission_name': permission_name}
    )
    if created:
        print(f"[PERMISSION] Created: {permission_name} (ID: {permission_id})")
    else:
        print(f"[PERMISSION] Verified: {permission_name} (ID: {permission_id})")

    # 2. Add to GlobalRolePermission
    perm_data = {
            'display_name': 'Generate Service Fees',
            'category': 'service_fees',
            'priority': 25,
            'description': 'Allow users to generate service fees/bills'
    }
    
    GlobalRolePermission.objects.update_or_create(
        permission=permission_obj,
        defaults=perm_data
    )
    print(f"[GLOBAL PERMISSION] Populated: {perm_data['display_name']} (ID: {permission_id})")


def remove_generate_service_fees_permission(apps, schema_editor):
    Permission = apps.get_model('group_role', 'Permission')
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')
    
    # Remove from GlobalRolePermission
    GlobalRolePermission.objects.filter(permission_id=PERMISSION_GENERATE_SERVICE_FEES).delete()
    
    # Remove from Permission
    Permission.objects.filter(id=PERMISSION_GENERATE_SERVICE_FEES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('group_role', '0011_populate_service_fee_management_permissions'),
    ]

    operations = [
        migrations.RunPython(
            populate_generate_service_fees_permission,
            remove_generate_service_fees_permission
        ),
    ]
