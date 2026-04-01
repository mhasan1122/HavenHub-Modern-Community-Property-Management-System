from django.db import migrations


def rename_permission(apps, schema_editor):
    Permission = apps.get_model('group_role', 'Permission')
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')

    Permission.objects.filter(id=59).update(permission_name='Edit Company Settings')
    GlobalRolePermission.objects.filter(permission_id=59).update(display_name='Edit Company Settings')


def rollback(apps, schema_editor):
    Permission = apps.get_model('group_role', 'Permission')
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')

    Permission.objects.filter(id=59).update(permission_name='View Company Settings')
    GlobalRolePermission.objects.filter(permission_id=59).update(display_name='View Company Settings')


class Migration(migrations.Migration):
    dependencies = [
        ('group_role', '0013_consolidate_bill_upload_permissions'),
    ]

    operations = [
        migrations.RunPython(rename_permission, rollback),
    ]
