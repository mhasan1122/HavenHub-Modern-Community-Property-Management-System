from django.db import migrations


NEW_PERMISSIONS = [
    "Add Announcements",
    "View Announcements",
    "Edit Announcements",
    "Add Bulletin Board",
    "View Bulletin Board",
    "Edit Bulletin Board",
    "Add Notice Board",
    "View Notice Board",
    "Edit Notice Board",
]


def add_permissions(apps, schema_editor):
    Permission = apps.get_model("group_role", "Permission")

    for permission_name in NEW_PERMISSIONS:
        Permission.objects.get_or_create(permission_name=permission_name)


def remove_permissions(apps, schema_editor):
    Permission = apps.get_model("group_role", "Permission")
    Permission.objects.filter(permission_name__in=NEW_PERMISSIONS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("group_role", "0003_membersrole_is_group_membersrole_is_member"),
    ]

    operations = [
        migrations.RunPython(add_permissions, remove_permissions),
    ]

