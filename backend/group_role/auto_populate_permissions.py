import os
import sys
import django
from django.db import connection

# Add the root directory of your project to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django.setup()

# Now you can import models and run your population logic
from group_role.models import Permission  # Import your model
from group_role.permission_constants import ALL_PERMISSION_NAMES

class AutoPopulatePermissions:
    def populate_permissions(self):
        from group_role.permission_constants import PERMISSION_NAME_BY_ID
        
        required_names = set(PERMISSION_NAME_BY_ID.values())
        
        # Check for existing permissions
        existing_names = set(Permission.objects.values_list('permission_name', flat=True))
        
        # Identify extra and missing
        extra_names = existing_names - required_names
        missing_names = required_names - existing_names
        
        if extra_names:
            # Drop extra obsolete permissions and related Protected referencing objects
            print(f"Deleting extra obsolete permissions from DB: {extra_names}")
            
            # Since Permission is referenced by RolePermission using PROTECT, we must manually delete them.
            permissions_to_delete = Permission.objects.filter(permission_name__in=extra_names)
            
            from group_role.models import RolePermission, GlobalRolePermission
            # Cascade delete RolePermissions referencing these permissions
            for p in permissions_to_delete:
                RolePermission.objects.filter(permission=p).delete()
                GlobalRolePermission.objects.filter(permission=p).delete()
                
            # Then delete the permissions
            permissions_to_delete.delete()
            
        if missing_names:
            print(f"Adding missing permissions to DB: {missing_names}")
            permissions_to_create = []
            for perm_id, perm_name in PERMISSION_NAME_BY_ID.items():
                if perm_name in missing_names:
                    # Provide exact ID to keep constants in sync with DB PKs
                    permissions_to_create.append(Permission(id=perm_id, permission_name=perm_name))
            
            # Create the missing permissions
            Permission.objects.bulk_create(permissions_to_create)
            
        if not extra_names and not missing_names:
            print("All required permissions are already strictly synced with the table.")

if __name__ == "__main__":
    populate = AutoPopulatePermissions()
    populate.populate_permissions()

