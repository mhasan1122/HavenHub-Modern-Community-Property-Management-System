from django.apps import AppConfig
from django.db.models.signals import post_migrate


class GroupRoleConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'group_role'
    
    def ready(self):
        """Import signals when the app is ready"""
        import group_role.signals  # noqa


def populate_permissions(sender, **kwargs):
    """
    Post-migrate hook to populate permissions safely after database
    migrations have completed. Runs only for this app's migration signal.
    """
    try:
        # Ensure we only run when this app's migrations have finished
        if getattr(sender, 'name', None) != 'group_role':
            return

        from .models import Permission
        from .permission_constants import ALL_PERMISSION_NAMES

        required_permissions = ALL_PERMISSION_NAMES.copy()

        # Check for existing permissions
        existing_permissions = set(Permission.objects.values_list('permission_name', flat=True))
        missing_permissions = set(required_permissions) - existing_permissions

        if missing_permissions:
            # Only create missing permissions (don't truncate)
            Permission.objects.bulk_create([
                Permission(permission_name=permission_name)
                for permission_name in missing_permissions
            ])
            print(f"[OK] Permissions populated: {len(missing_permissions)} new permissions added")
        else:
            print("[OK] All required permissions are already in the table.")

    except Exception as e:
        print(f"[ERROR] Failed to populate permissions in post_migrate: {e}")
        import traceback
        traceback.print_exc()


# Connect the post_migrate signal at module level (not in ready())
# This avoids the "Accessing the database during app initialization" warning
post_migrate.connect(
    populate_permissions,
    sender=GroupRoleConfig,
    weak=False,
    dispatch_uid='group_role_populate_permissions',
)
