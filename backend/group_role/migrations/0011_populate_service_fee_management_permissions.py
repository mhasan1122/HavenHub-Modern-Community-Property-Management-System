# Generated migration to populate Service Fee Management permissions in GlobalRolePermission

from django.db import migrations
from group_role.permission_constants import (
    PERMISSION_VIEW_BILL_CATEGORIES,
    PERMISSION_ADD_BILL_CATEGORIES,
    PERMISSION_EDIT_BILL_CATEGORIES,
    PERMISSION_VIEW_BILLING_MANAGEMENT,
    PERMISSION_BILL_UPLOADS,
    PERMISSION_NAME_BY_ID,
)


def populate_service_fee_management_permissions(apps, schema_editor):
    """Populate Service Fee Management related permissions in GlobalRolePermission"""
    Permission = apps.get_model('group_role', 'Permission')
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')
    
    # Service Fee Management permissions including Bill Categories, Billing Management, and Bill Uploads
    PERMISSIONS_TO_ADD = [
        # Bill Categories
        {
            'permission_id': PERMISSION_VIEW_BILL_CATEGORIES,
            'display_name': 'View Bill Categories',
            'category': 'service_fees',
            'priority': 24,
            'description': 'Allow users to view bill categories'
        },
        {
            'permission_id': PERMISSION_ADD_BILL_CATEGORIES,
            'display_name': 'Add Bill Categories',
            'category': 'service_fees',
            'priority': 23,
            'description': 'Allow users to create bill categories'
        },
        {
            'permission_id': PERMISSION_EDIT_BILL_CATEGORIES,
            'display_name': 'Edit Bill Categories',
            'category': 'service_fees',
            'priority': 22,
            'description': 'Allow users to edit bill categories'
        },
        # Billing Management
        {
            'permission_id': PERMISSION_VIEW_BILLING_MANAGEMENT,
            'display_name': 'View Billing Management',
            'category': 'service_fees',
            'priority': 21,
            'description': 'Allow users to view billing management'
        },

        # Bill Uploads
        {
            'permission_id': PERMISSION_BILL_UPLOADS,
            'display_name': 'Bill Uploads',
            'category': 'service_fees',
            'priority': 18,
            'description': 'Allow users to manage bill uploads'
        },
    ]
    
    for perm_data in PERMISSIONS_TO_ADD:
        permission_id = perm_data.pop('permission_id')
        try:
            permission = Permission.objects.get(id=permission_id)
            GlobalRolePermission.objects.get_or_create(
                permission=permission,
                defaults=perm_data
            )
            print(f"[GLOBAL PERMISSION] Populated: {perm_data['display_name']} (ID: {permission_id})")
        except Permission.DoesNotExist:
            print(f"[WARNING] Permission ID {permission_id} not found in Permission table")


def remove_service_fee_management_permissions(apps, schema_editor):
    """Remove Service Fee Management permissions from GlobalRolePermission (for rollback)"""
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')
    
    permission_ids = [
        PERMISSION_VIEW_BILL_CATEGORIES,
        PERMISSION_ADD_BILL_CATEGORIES,
        PERMISSION_EDIT_BILL_CATEGORIES,
        PERMISSION_VIEW_BILLING_MANAGEMENT,
        PERMISSION_BILL_UPLOADS,
    ]
    
    for permission_id in permission_ids:
        GlobalRolePermission.objects.filter(permission_id=permission_id).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('group_role', '0010_add_bill_uploads_permissions'),
    ]

    operations = [
        migrations.RunPython(
            populate_service_fee_management_permissions,
            remove_service_fee_management_permissions
        ),
    ]
