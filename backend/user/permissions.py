import logging
from rest_framework.permissions import BasePermission
from group_role.models import Member

logger = logging.getLogger(__name__)

class HasRequiredPermission(BasePermission):
    def has_permission(self, request, view):
        try:
            member = request.user.member
        except Exception:
            member = Member.objects.filter(user=request.user).first()

        if not member:
            # logger.warning(f"User {request.user} is not linked to a member.")
            return False

        # Special case: Check if user is viewing their own profile
        # Get the pk from view kwargs (for detail views like member_details/<int:pk>/)
        profile_id = view.kwargs.get('pk') or view.kwargs.get('id')
        
        if profile_id:
            try:
                profile_id = int(profile_id)
                # If user is viewing their own profile, allow access without permission check
                if member.id == profile_id:
                    logger.debug(f"Access granted for user {request.user} viewing their own profile (ID: {member.id}).")
                    return True
            except (ValueError, TypeError):
                # If pk/id is not a valid integer, proceed with normal permission check
                pass

        # Retrieve required permissions from the view
        required_permissions = getattr(view, 'required_permission_id', [])
        
        # If required_permissions is a dictionary, get the permission for the current method
        if isinstance(required_permissions, dict):
            required_permissions = required_permissions.get(request.method, [])

        if not isinstance(required_permissions, list):
            required_permissions = [required_permissions]

        # If no required permissions are specified, allow access.
        if not required_permissions:
            return True

        # NEW PERMISSION LOGIC:
        # - Community members (is_comm_member=True) don't need granular permissions -
        #   they access their own data as residents/owners.
        # - Organization-only members (is_org_member=True, not comm) use the permission system.
        if member.is_comm_member:
            # Community members don't use the granular permission system
            logger.debug(f"Access granted for community member {request.user} without permission check.")
            return True

        # If user is an organization member, check permissions
        if member.is_org_member:
            # Get the user's permission IDs.
            user_permission_ids = member.get_permission_ids()

            try:
                user_permission_ids = set(map(int, user_permission_ids))
                required_permissions = list(map(int, required_permissions))
            except Exception as e:
                print(f"DEBUG: Error converting permission types for user {request.user}: {e}")
                logger.error(f"Error converting permission types for user {request.user}: {e}")
                return False

            print(f"DEBUG: User {request.user} has permissions {user_permission_ids}. Required: {required_permissions}")
            logger.debug(f"User {request.user} has permissions {user_permission_ids}. Required: {required_permissions}")

            # Check if at least one required permission is in the user's permissions.
            has_access = any(permission in user_permission_ids for permission in required_permissions)
            if has_access:
                print(f"DEBUG: Access granted for user {request.user}.")
                logger.info(f"Access granted for user {request.user}.")
            else:
                print(f"DEBUG: Access denied for user {request.user}. Missing required permissions: {required_permissions}")
                logger.info(f"Access denied for user {request.user}. Missing required permissions: {required_permissions}")
            return has_access
        
        # If user is neither comm member nor org member, deny access
        logger.warning(f"User {request.user} is neither a community member nor an organization member.")
        return False
