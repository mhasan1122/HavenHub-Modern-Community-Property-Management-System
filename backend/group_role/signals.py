"""
Signals for group_role app to handle permission grant notifications
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from .models import MembersRole, RolePermission, GroupMembers
from group_role.permission_constants import (
    PERMISSION_VIEW_BULLETIN_BOARD,
    PERMISSION_VIEW_ANNOUNCEMENTS,
    PERMISSION_VIEW_NOTICE_BOARD,
    PERMISSION_VIEW_MEMBER_LIST,
)


@receiver(post_save, sender=MembersRole)
def handle_members_role_change(sender, instance, created, **kwargs):
    """
    Handle MembersRole creation/update to send notifications when users get bulletin permission.
    This ensures users who previously had no bulletin permission receive notifications
    after permission is granted.
    """
    try:
        # Only process active role assignments
        if not instance.is_active:
            return
        
        # Check which permissions this role has
        role_has_bulletin_permission = RolePermission.objects.filter(
            role=instance.role,
            permission_id=PERMISSION_VIEW_BULLETIN_BOARD,
            is_active=True
        ).exists()
        
        role_has_announcement_permission = RolePermission.objects.filter(
            role=instance.role,
            permission_id=PERMISSION_VIEW_ANNOUNCEMENTS,
            is_active=True
        ).exists()
        
        role_has_notice_permission = RolePermission.objects.filter(
            role=instance.role,
            permission_id=PERMISSION_VIEW_NOTICE_BOARD,
            is_active=True
        ).exists()
        
        # If role has none of these permissions, nothing to do
        if not (role_has_bulletin_permission or role_has_announcement_permission or role_has_notice_permission):
            return
        
        member = instance.member
        
        # IMPORTANT: Use the LATER of member creation time or permission grant time
        # This ensures notifications are only for items created AFTER:
        # 1. The member joined the system, AND
        # 2. They received the permission
        # This prevents retroactive notifications in two scenarios:
        # - New member with immediate permissions: use member.created_at
        # - Existing member given new permissions: use permission grant time
        if created:
            role_grant_time = instance.created_at or timezone.now()
        else:
            # For updates, use updated_at to catch permission re-grants
            role_grant_time = instance.updated_at or timezone.now()
        
        # Use the MORE RECENT timestamp to avoid retroactive notifications
        if member.created_at:
            grant_timestamp = max(member.created_at, role_grant_time)
        else:
            grant_timestamp = role_grant_time
        
        # Import here to avoid circular imports
        from notifications.utils import (
            create_notifications_for_new_bulletin_permission,
            create_notifications_for_new_announcement_permission,
            create_notifications_for_new_notice_permission,
        )
        
        # Create notifications for each permission type the role has
        if role_has_bulletin_permission:
            print(f"[SIGNAL] MembersRole {'created' if created else 'updated'} for member {member.id}, role {instance.role.id} - checking for bulletin notifications")
            create_notifications_for_new_bulletin_permission(member, grant_timestamp)
        
        if role_has_announcement_permission:
            print(f"[SIGNAL] MembersRole {'created' if created else 'updated'} for member {member.id}, role {instance.role.id} - checking for announcement notifications")
            create_notifications_for_new_announcement_permission(member, grant_timestamp)
        
        if role_has_notice_permission:
            print(f"[SIGNAL] MembersRole {'created' if created else 'updated'} for member {member.id}, role {instance.role.id} - checking for notice notifications")
            create_notifications_for_new_notice_permission(member, grant_timestamp)
        
    except Exception as e:
        print(f"[SIGNAL] Error in handle_members_role_change: {e}")
        import traceback
        traceback.print_exc()


@receiver(post_save, sender=RolePermission)
def handle_role_permission_change(sender, instance, created, **kwargs):
    """
    Handle RolePermission creation to send notifications when bulletin permission is added to a role.
    This ensures all members with this role receive notifications for current bulletins.
    """
    try:
        # Only process active permissions
        if not instance.is_active:
            return
        
        # Check which permission type this is
        is_bulletin_permission = instance.permission_id == PERMISSION_VIEW_BULLETIN_BOARD
        is_announcement_permission = instance.permission_id == PERMISSION_VIEW_ANNOUNCEMENTS
        is_notice_permission = instance.permission_id == PERMISSION_VIEW_NOTICE_BOARD
        
        # Only process if this is one of the view permissions we care about
        if not (is_bulletin_permission or is_announcement_permission or is_notice_permission):
            return
        
        # Get all members who have this role (active role assignments)
        members_with_role = MembersRole.objects.filter(
            role=instance.role,
            is_active=True
        ).select_related('member')
        
        if not members_with_role.exists():
            return
        
        # Use the RolePermission created_at/updated_at as the grant timestamp
        if created:
            grant_timestamp = instance.created_at or timezone.now()
        else:
            # For updates, use updated_at
            grant_timestamp = instance.updated_at or timezone.now()
        
        # Import here to avoid circular imports
        from notifications.utils import (
            create_notifications_for_new_bulletin_permission,
            create_notifications_for_new_announcement_permission,
            create_notifications_for_new_notice_permission,
        )
        
        print(f"[SIGNAL] RolePermission {'created' if created else 'updated'} for role {instance.role.id}, permission {instance.permission_id} - notifying {members_with_role.count()} members")
        
        # Create notifications for each member with this role
        for member_role in members_with_role:
            member = member_role.member
            # Use the later of role assignment time and permission grant time
            member_grant_timestamp = max(
                grant_timestamp,
                member_role.created_at or timezone.now(),
                member_role.updated_at or timezone.now()
            )
            
            if is_bulletin_permission:
                create_notifications_for_new_bulletin_permission(member, member_grant_timestamp)
            elif is_announcement_permission:
                create_notifications_for_new_announcement_permission(member, member_grant_timestamp)
            elif is_notice_permission:
                create_notifications_for_new_notice_permission(member, member_grant_timestamp)
        
    except Exception as e:
        print(f"[SIGNAL] Error in handle_role_permission_change: {e}")
        import traceback
        traceback.print_exc()


@receiver(post_save, sender=MembersRole)
def notify_member_role_assigned(sender, instance, created, **kwargs):
    """
    Notify a member when they are assigned a new role.
    Only notifies for new role assignments, not updates.
    """
    try:
        # Only notify for new role assignments
        if not created:
            return
        
        # Only process active role assignments
        if not instance.is_active:
            return
        
        from django.db import transaction
        from notifications.utils import create_role_assigned_notification
        
        # Get the member who assigned the role (if available)
        assigner = instance.created_by if hasattr(instance, 'created_by') else None
        
        # Check if role came from group membership
        from_group = instance.is_group if hasattr(instance, 'is_group') else False
        
        def create_notification():
            """Create notification after transaction commits"""
            try:
                group_name = None
                
                # If role came from group, try to get the group name
                if from_group:
                    try:
                        # Find which group this role assignment is associated with
                        from .models import GroupMembers, RoleGroup
                        
                        # Get all groups this member belongs to
                        member_groups = GroupMembers.objects.filter(
                            member=instance.member,
                            is_active=True
                        ).select_related('group')
                        
                        # Check which group has this role
                        for gm in member_groups:
                            if RoleGroup.objects.filter(group=gm.group, role=instance.role).exists():
                                group_name = gm.group.group_name
                                break
                    except Exception as group_error:
                        print(f"[SIGNAL] Could not determine group name: {group_error}")
                
                # Create notifications for the member and assigner
                recipient_notif, assigner_notif = create_role_assigned_notification(
                    member=instance.member,
                    role=instance.role,
                    assigner=assigner,
                    from_group=from_group,
                    group_name=group_name
                )
                print(f"[SIGNAL] Created role assignment notifications (from_group={from_group}, group={group_name}) - recipient: {recipient_notif.id if recipient_notif else None}, assigner: {assigner_notif.id if assigner_notif else None}")
            except Exception as e:
                print(f"[SIGNAL] Error creating notification: {e}")
                import traceback
                traceback.print_exc()
        
        # Schedule notification creation after transaction commits
        transaction.on_commit(create_notification)
        
    except Exception as e:
        print(f"[SIGNAL] Error in notify_member_role_assigned: {e}")
        import traceback
        traceback.print_exc()


@receiver(post_save, sender=GroupMembers)
def notify_member_group_added(sender, instance, created, **kwargs):
    """
    Notify a member when they are added to a group.
    Only notifies for new group memberships, not updates.
    """
    try:
        # Only notify for new group memberships
        if not created:
            return
        
        from django.db import transaction
        from notifications.utils import create_group_added_notification
        
        # Get the member who added them to the group (if available)
        assigner = instance.created_by if hasattr(instance, 'created_by') else None
        
        def create_notification():
            """Create notification after transaction commits"""
            try:
                # Create notifications for the member and assigner
                recipient_notif, assigner_notif = create_group_added_notification(
                    member=instance.member,
                    group=instance.group,
                    assigner=assigner
                )
                print(f"[SIGNAL] Created group added notifications - recipient: {recipient_notif.id if recipient_notif else None}, assigner: {assigner_notif.id if assigner_notif else None}")
            except Exception as e:
                print(f"[SIGNAL] Error creating group notification: {e}")
                import traceback
                traceback.print_exc()
        
        # Schedule notification creation after transaction commits
        transaction.on_commit(create_notification)
        
    except Exception as e:
        print(f"[SIGNAL] Error in notify_member_group_added: {e}")
        import traceback
        traceback.print_exc()

