from django.db import migrations

def consolidate_permissions(apps, schema_editor):
    Permission = apps.get_model('group_role', 'Permission')
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')
    RolePermission = apps.get_model('group_role', 'RolePermission')

    # 1. Rename ID 69 to the consolidated name
    Permission.objects.filter(id=69).update(permission_name='Bill Uploads')
    GlobalRolePermission.objects.filter(permission_id=69).update(display_name='Bill Uploads')

    # 2. Identify IDs to remove
    ids_to_remove = [70, 71]

    # 3. Handle RolePermission transfers: 
    # If a role had 70 or 71 but NOT 69, give them 69 before deleting.
    # (Actually, usually Superadmin has all, but for safety:)
    for rp in RolePermission.objects.filter(permission_id__in=ids_to_remove):
        if not RolePermission.objects.filter(role=rp.role, permission_id=69).exists():
            RolePermission.objects.create(
                role=rp.role,
                permission_id=69,
                created_by=rp.created_by
            )

    # 4. Delete redundant records
    RolePermission.objects.filter(permission_id__in=ids_to_remove).delete()
    GlobalRolePermission.objects.filter(permission_id__in=ids_to_remove).delete()
    Permission.objects.filter(id__in=ids_to_remove).delete()

def rollback_consolidation(apps, schema_editor):
    # This is a one-way cleanup, but for completeness we can leave it empty or 
    # re-create them. Given the goal is consolidation, rollback is rarely needed.
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('group_role', '0012_populate_generate_service_fees_permission'),
    ]

    operations = [
        migrations.RunPython(consolidate_permissions, rollback_consolidation),
    ]
