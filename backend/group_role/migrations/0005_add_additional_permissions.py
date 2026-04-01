from django.db import migrations


NEW_PERMISSIONS = [
    "View Important Contacts",
    "View Service Fee Settings",
    "Add Important Contacts",
    "Edit Important Contacts",
    "Add Service Fee Settings",
    "Edit Service Fee Settings",
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
        ("group_role", "0004_add_communication_permissions"),
    ]

    operations = [
        migrations.RunPython(add_permissions, remove_permissions),
    ]


