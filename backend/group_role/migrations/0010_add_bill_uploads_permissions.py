# Generated migration to add Bill Uploads permissions

from django.db import migrations
from group_role.permission_constants import (
    PERMISSION_BILL_UPLOADS,
    PERMISSION_NAME_BY_ID,
)


def add_bill_uploads_permissions(apps, schema_editor):
    """Add Bill Uploads permissions to the database"""
    Permission = apps.get_model('group_role', 'Permission')
    
    permissions_to_add = [
        PERMISSION_BILL_UPLOADS,
    ]
    
    for permission_id in permissions_to_add:
        permission_name = PERMISSION_NAME_BY_ID.get(permission_id)
        if permission_name:
            # Create if doesn't exist
            Permission.objects.get_or_create(
                id=permission_id,
                defaults={'permission_name': permission_name}
            )
            print(f"[PERMISSION] Created: {permission_name} (ID: {permission_id})")


def remove_bill_uploads_permissions(apps, schema_editor):
    """Remove Bill Uploads permissions (for rollback)"""
    Permission = apps.get_model('group_role', 'Permission')
    
    permissions_to_remove = [
        PERMISSION_BILL_UPLOADS,
    ]
    
    for permission_id in permissions_to_remove:
        Permission.objects.filter(id=permission_id).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('group_role', '0009_global_role_permissions'),
    ]

    operations = [
        migrations.RunPython(add_bill_uploads_permissions, remove_bill_uploads_permissions),
    ]
