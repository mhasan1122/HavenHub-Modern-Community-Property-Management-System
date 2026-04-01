from rest_framework.permissions import BasePermission

from group_role.models import MembersRole


class IsAdminMember(BasePermission):
    """
    Permission class that grants access only to users linked to a Member with the Admin role.
    """

    message = "You must be an Admin to perform this action."

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        member = getattr(user, "member", None)
        if not member:
            return False

        return MembersRole.objects.filter(
            member=member,
            role__role_name__iexact="Admin",
            is_active=True,
        ).exists()

